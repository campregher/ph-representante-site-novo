import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";
import { ML_APP_ID } from "@/lib/ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

/* Extrai o order_id do resource "/orders/123456" */
function extractOrderId(resource: string): string | null {
  const m = resource.match(/\/orders\/(\d+)/);
  return m ? m[1] : null;
}

/* Busca URL da etiqueta de envio */
async function fetchLabelUrl(shippingId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${ML_BASE}/shipments/${shippingId}/labels?response_type=link`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data === "string" ? data : data?.label_url ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  /* Sempre retorna 200 imediatamente para ack ao ML */
  const body = await request.json().catch(() => ({})) as {
    topic?:          string;
    resource?:       string;
    user_id?:        number;
    application_id?: number;
  };

  /* Só processa notificações de pedidos do nosso app */
  if (body.topic !== "orders_v2" || !body.resource || !body.user_id) {
    return NextResponse.json({ ok: true });
  }

  const appId = String(body.application_id ?? "");
  if (appId && appId !== ML_APP_ID) {
    return NextResponse.json({ ok: true });
  }

  const orderId = extractOrderId(body.resource);
  if (!orderId) return NextResponse.json({ ok: true });

  const mlUserId = String(body.user_id);

  try {
    const db = await createAdminClient();

    /* Verifica se já existe pedido para este order_id (idempotência) */
    const { data: existing } = await db
      .from("orcamentos")
      .select("id")
      .eq("ml_order_id", orderId)
      .maybeSingle();

    if (existing) return NextResponse.json({ ok: true });

    /* Encontra o cliente portal pelo ml_user_id */
    const { data: tokenRow } = await db
      .from("portal_ml_tokens")
      .select("cliente_id")
      .eq("ml_user_id", mlUserId)
      .maybeSingle();

    if (!tokenRow) return NextResponse.json({ ok: true }); /* não é cliente nosso */

    const authUserId = tokenRow.cliente_id; /* auth user UUID */

    /* Resolve clientes.id (FK de orcamentos) */
    const { data: clienteRow } = await db
      .from("clientes")
      .select("id")
      .eq("user_id", authUserId)
      .single();

    if (!clienteRow) return NextResponse.json({ ok: true });

    const clienteId = clienteRow.id; /* clientes.id para FK */

    /* Busca token válido do cliente */
    const token = await getValidPortalToken(authUserId).catch(() => null);
    if (!token) return NextResponse.json({ ok: true });

    /* Busca detalhes do pedido no ML */
    const orderRes = await fetch(`${ML_BASE}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!orderRes.ok) return NextResponse.json({ ok: true });

    const order = await orderRes.json() as MLOrder;

    /* Só cria pedido se pagamento confirmado */
    const isPaid = order.status === "paid" ||
      order.payments?.some(p => p.status === "approved");

    if (!isPaid) return NextResponse.json({ ok: true });

    /* Mapeia itens do pedido via portal_ml_anuncios */
    const mlItemIds = (order.order_items ?? []).map(i => i.item.id);
    if (mlItemIds.length === 0) return NextResponse.json({ ok: true });

    const { data: anuncios } = await db
      .from("portal_ml_anuncios")
      .select("produto_id, marca_slug, ml_item_id, preco_revenda")
      .in("ml_item_id", mlItemIds)
      .eq("cliente_id", authUserId); /* portal_ml_anuncios usa auth UUID */

    if (!anuncios || anuncios.length === 0) return NextResponse.json({ ok: true });

    /* Agrupa por marca (pode ter itens de marcas diferentes) */
    const byMarca: Record<string, typeof anuncios> = {};
    for (const a of anuncios) {
      if (!byMarca[a.marca_slug]) byMarca[a.marca_slug] = [];
      byMarca[a.marca_slug].push(a);
    }

    /* Busca dados do produto para cada anúncio */
    const produtoIds = anuncios.map(a => a.produto_id);
    const { data: produtos } = await db
      .from("produtos")
      .select("id, sku, name, resale_price")
      .in("id", produtoIds);

    const prodMap = Object.fromEntries((produtos ?? []).map(p => [p.id, p]));

    /* Dados do comprador / envio */
    const buyer       = order.buyer;
    const shipping    = order.shipping;
    const shippingId  = String(shipping?.id ?? "");
    const destination = shipping?.receiver_address;

    /* Busca etiqueta de envio */
    const labelUrl = shippingId ? await fetchLabelUrl(shippingId, token) : null;

    /* Cria um pedido por marca */
    for (const [marcaSlug, itens] of Object.entries(byMarca)) {
      const orderItems = itens.map(a => {
        const mlItem = order.order_items?.find(oi => oi.item.id === a.ml_item_id);
        const produto = prodMap[a.produto_id];
        return {
          produto_sku:    produto?.sku   ?? a.ml_item_id,
          produto_nome:   produto?.name  ?? mlItem?.item.title ?? a.ml_item_id,
          quantidade:     mlItem?.quantity ?? 1,
          valor_unitario: a.preco_revenda ?? mlItem?.unit_price ?? 0,
        };
      });

      const total = orderItems.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);

      /* Insere orcamento */
      const { data: orcamento, error: orcErr } = await db
        .from("orcamentos")
        .insert({
          cliente_id:        clienteId,
          marca:             marcaSlug,
          tipo_pedido:       "dropshipping",
          condicao_pagamento:"semanal",
          status:            "enviado",
          total,
          ml_order_id:       orderId,
          ml_shipping_id:    shippingId || null,
          dropship_cliente_id: clienteId,
          observacoes: destination
            ? `Envio ML #${orderId} — ${destination.street_name ?? ""} ${destination.street_number ?? ""}, ${destination.city?.name ?? ""} / ${destination.state?.name ?? ""} — CEP: ${destination.zip_code ?? ""}`
            : `Pedido ML #${orderId}`,
        })
        .select("id, numero")
        .single();

      if (orcErr || !orcamento) continue;

      /* Insere itens */
      await db.from("orcamento_itens").insert(
        orderItems.map(i => ({ ...i, orcamento_id: orcamento.id }))
      );

      /* Insere etiqueta se disponível */
      if (labelUrl) {
        await db.from("orcamento_etiquetas").insert({
          orcamento_id: orcamento.id,
          nome:         `Etiqueta ML #${orderId}`,
          url:          labelUrl,
        });
      }

    }
  } catch (err) {
    console.error("ML webhook error:", err);
    /* Sempre retorna 200 para ML não retentar indefinidamente */
  }

  return NextResponse.json({ ok: true });
}

/* ─── Tipos ML (simplificados) ─── */

interface MLOrder {
  id:          number;
  status:      string;
  buyer:       { id: number; nickname: string };
  shipping:    { id: number; receiver_address: MLAddress } | null;
  payments:    { status: string }[];
  order_items: { item: { id: string; title: string }; quantity: number; unit_price: number }[];
}

interface MLAddress {
  street_name:   string;
  street_number: string;
  zip_code:      string;
  city:          { name: string } | null;
  state:         { name: string } | null;
}
