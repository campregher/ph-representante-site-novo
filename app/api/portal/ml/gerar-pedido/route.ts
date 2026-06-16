import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ml_order_id = body?.ml_order_id;
  if (!ml_order_id) return NextResponse.json({ error: "ml_order_id obrigatório" }, { status: 400 });

  const orderId = String(ml_order_id);
  const db = await createAdminClient();

  /* Idempotência: verifica se pedido já existe */
  const { data: existing } = await db
    .from("orcamentos")
    .select("id, numero")
    .eq("ml_order_id", orderId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Pedido já gerado", pedido_id: existing.id, pedido_numero: existing.numero },
      { status: 409 }
    );
  }

  /* Resolve clientes.id */
  const { data: clienteRow } = await db
    .from("clientes")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!clienteRow) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  /* Token ML */
  const token = await getValidPortalToken(user.id).catch(() => null);
  if (!token) return NextResponse.json({ error: "Conta ML não conectada" }, { status: 403 });

  /* Busca pedido no ML */
  const orderRes = await fetch(`${ML_BASE}/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!orderRes.ok) {
    return NextResponse.json({ error: "Pedido não encontrado no Mercado Livre" }, { status: 404 });
  }
  const order = await orderRes.json() as {
    id: number; status: string;
    buyer: { id: number; nickname: string };
    shipping: { id: number; receiver_address: MLAddress } | null;
    payments: { status: string }[];
    order_items: { item: { id: string; title: string }; quantity: number; unit_price: number }[];
  };

  /* Só cria se pago */
  const isPaid = order.status === "paid" ||
    order.payments?.some(p => p.status === "approved");
  if (!isPaid) {
    return NextResponse.json({ error: "Pedido não está pago ainda" }, { status: 400 });
  }

  const mlItemIds = (order.order_items ?? []).map(i => i.item.id);
  if (!mlItemIds.length) return NextResponse.json({ error: "Pedido sem itens" }, { status: 400 });

  /* Anúncios vinculados */
  const { data: anuncios } = await db
    .from("portal_ml_anuncios")
    .select("produto_id, marca_slug, ml_item_id, preco_revenda")
    .in("ml_item_id", mlItemIds)
    .eq("cliente_id", user.id);

  if (!anuncios?.length) {
    return NextResponse.json(
      { error: "Nenhum produto vinculado neste pedido. Vincule os anúncios antes de gerar o pedido." },
      { status: 400 }
    );
  }

  /* Produtos */
  const produtoIds = anuncios.map(a => a.produto_id);
  const { data: produtos } = await db
    .from("produtos")
    .select("id, sku, name")
    .in("id", produtoIds);
  const prodMap = Object.fromEntries((produtos ?? []).map(p => [p.id, p]));

  /* Dados de envio */
  const shipping   = order.shipping;
  const shippingId = String(shipping?.id ?? "");
  const dest       = shipping?.receiver_address;

  const labelUrl = shippingId ? await fetchLabelUrl(shippingId, token) : null;

  /* Agrupa por marca */
  const byMarca: Record<string, typeof anuncios> = {};
  for (const a of anuncios) {
    if (!byMarca[a.marca_slug]) byMarca[a.marca_slug] = [];
    byMarca[a.marca_slug].push(a);
  }

  const created: { id: string; numero: number; marca: string }[] = [];

  for (const [marcaSlug, itens] of Object.entries(byMarca)) {
    const orderItems = itens.map(a => {
      const mlItem  = order.order_items?.find(oi => oi.item.id === a.ml_item_id);
      const produto = prodMap[a.produto_id] as { sku: string; name: string } | undefined;
      return {
        produto_sku:    produto?.sku   ?? a.ml_item_id,
        produto_nome:   produto?.name  ?? mlItem?.item.title ?? a.ml_item_id,
        quantidade:     mlItem?.quantity    ?? 1,
        valor_unitario: a.preco_revenda ?? mlItem?.unit_price ?? 0,
      };
    });

    const total = orderItems.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);

    const observacoes = dest
      ? `Envio ML #${orderId} — ${dest.street_name ?? ""} ${dest.street_number ?? ""}, ${dest.city?.name ?? ""} / ${dest.state?.name ?? ""} — CEP: ${dest.zip_code ?? ""}`
      : `Pedido ML #${orderId}`;

    const { data: orcamento, error: orcErr } = await db
      .from("orcamentos")
      .insert({
        cliente_id:        clienteRow.id,
        marca:             marcaSlug,
        tipo_pedido:       "dropshipping",
        condicao_pagamento:"semanal",
        status:            "enviado",
        total,
        ml_order_id:       orderId,
        ml_shipping_id:    shippingId || null,
        observacoes,
      })
      .select("id, numero")
      .single();

    if (orcErr || !orcamento) continue;

    await db.from("orcamento_itens").insert(
      orderItems.map(i => ({ ...i, orcamento_id: orcamento.id }))
    );

    if (labelUrl) {
      await db.from("orcamento_etiquetas").insert({
        orcamento_id: orcamento.id,
        nome:         `Etiqueta ML #${orderId}`,
        url:          labelUrl,
      });
    }

    created.push({ id: orcamento.id, numero: orcamento.numero, marca: marcaSlug });
  }

  if (!created.length) {
    return NextResponse.json({ error: "Não foi possível gerar o pedido" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pedidos: created });
}

interface MLAddress {
  street_name:   string;
  street_number: string;
  zip_code:      string;
  city:          { name: string } | null;
  state:         { name: string } | null;
}
