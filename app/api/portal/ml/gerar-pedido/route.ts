import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";
const ML_WEB  = "https://www.mercadolivre.com.br";

interface MLOrder {
  id: number;
  status: string;
  payments: { status: string }[];
  shipping: { id: number; receiver_address: MLAddress } | null;
  order_items: { item: { id: string; title: string }; quantity: number; unit_price: number }[];
}
interface MLAddress {
  street_name: string; street_number: string; zip_code: string;
  city: { name: string } | null; state: { name: string } | null;
}

async function fetchTrackingUrl(shippingId: string, _token: string): Promise<string> {
  /* URL direta via shipment ID — não requer tracking_number */
  return `${ML_WEB}/envios/etiqueta/print/shipment/${shippingId}?print=true`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  /* Suporta ml_order_id (singular) e ml_order_ids (array) */
  const rawIds: (string | number)[] = body?.ml_order_ids ?? (body?.ml_order_id ? [body.ml_order_id] : []);
  if (!rawIds.length) return NextResponse.json({ error: "ml_order_ids obrigatório" }, { status: 400 });
  const orderIds = rawIds.map(String);

  const db        = await createAdminClient();
  const token     = await getValidPortalToken(user.id).catch(() => null);
  if (!token) return NextResponse.json({ error: "Conta ML não conectada" }, { status: 403 });

  const { data: clienteRow } = await db.from("clientes").select("id").eq("user_id", user.id).maybeSingle();
  if (!clienteRow) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  /* Idempotência: verifica quais order_ids já têm pedido */
  const { data: existentes } = await db
    .from("orcamentos")
    .select("id, numero, ml_order_id")
    .in("ml_order_id", orderIds);

  const existentesIds = (existentes ?? []).map(e => e.ml_order_id);
  const novosIds      = orderIds.filter(id => !existentesIds.includes(id));

  if (!novosIds.length) {
    return NextResponse.json({
      error: "Todos os pedidos selecionados já foram enviados para a marca.",
      pedidos: existentes?.map(e => ({ id: e.id, numero: e.numero })) ?? [],
    }, { status: 409 });
  }

  /* Busca todos os pedidos no ML em paralelo */
  const mlOrders = await Promise.all(
    novosIds.map(async id => {
      const r = await fetch(`${ML_BASE}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      return { orderId: id, data: await r.json() as MLOrder };
    })
  );

  const validOrders = mlOrders.filter(Boolean) as { orderId: string; data: MLOrder }[];

  /* Verifica pagamento */
  const naoPagei = validOrders.filter(({ data: o }) =>
    o.status !== "paid" && !o.payments?.some(p => p.status === "approved")
  );
  if (naoPagei.length) {
    return NextResponse.json({
      error: `Pedido(s) ML #${naoPagei.map(o => o.orderId).join(", ")} ainda não pagos.`,
    }, { status: 400 });
  }

  /* Coleta todos os ml_item_ids de todos os pedidos */
  const allMlItemIds = validOrders.flatMap(({ data: o }) =>
    (o.order_items ?? []).map(i => i.item.id)
  );
  if (!allMlItemIds.length) return NextResponse.json({ error: "Pedidos sem itens" }, { status: 400 });

  /* Anúncios vinculados */
  const { data: anuncios } = await db
    .from("portal_ml_anuncios")
    .select("produto_id, marca_slug, ml_item_id, preco_revenda")
    .in("ml_item_id", allMlItemIds)
    .eq("cliente_id", user.id);

  if (!anuncios?.length) {
    return NextResponse.json({
      error: "Nenhum produto vinculado nos pedidos selecionados. Vincule os anúncios antes de enviar.",
    }, { status: 400 });
  }

  /* Produtos */
  const produtoIds = [...new Set(anuncios.map(a => a.produto_id))];
  const { data: produtos } = await db.from("produtos").select("id, sku, name").in("id", produtoIds);
  const prodMap = Object.fromEntries((produtos ?? []).map(p => [p.id, p]));

  /* Agrega por marca → produto_id: soma quantidades */
  type ItemAgg = { produto_sku: string; produto_nome: string; quantidade: number; valor_unitario: number };
  const byMarca: Record<string, Map<string, ItemAgg>> = {};

  for (const { orderId, data: order } of validOrders) {
    for (const anuncio of anuncios) {
      const mlItem = (order.order_items ?? []).find(oi => oi.item.id === anuncio.ml_item_id);
      if (!mlItem) continue;

      const m = anuncio.marca_slug;
      if (!byMarca[m]) byMarca[m] = new Map();

      const produto = prodMap[anuncio.produto_id] as { sku: string; name: string } | undefined;
      const precoUnit = Number(anuncio.preco_revenda ?? mlItem.unit_price ?? 0);
      const qty       = mlItem.quantity ?? 1;

      const key = anuncio.produto_id;
      if (byMarca[m].has(key)) {
        byMarca[m].get(key)!.quantidade += qty;
      } else {
        byMarca[m].set(key, {
          produto_sku:    produto?.sku  ?? anuncio.ml_item_id,
          produto_nome:   produto?.name ?? mlItem.item.title ?? anuncio.ml_item_id,
          quantidade:     qty,
          valor_unitario: precoUnit,
        });
      }
    }
  }

  /* Texto de observação com todos os IDs e endereços */
  const dest = validOrders[0]?.data?.shipping?.receiver_address;
  const idsStr = novosIds.map(id => `#${id}`).join(", ");
  const observacoes = novosIds.length > 1
    ? `Pedido agrupado — Vendas ML ${idsStr}${dest ? ` — ${dest.street_name ?? ""} ${dest.street_number ?? ""}, ${dest.city?.name ?? ""}/${dest.state?.name ?? ""} CEP ${dest.zip_code ?? ""}` : ""}`
    : `Pedido ML #${novosIds[0]}${dest ? ` — ${dest.street_name ?? ""} ${dest.street_number ?? ""}, ${dest.city?.name ?? ""}/${dest.state?.name ?? ""} CEP ${dest.zip_code ?? ""}` : ""}`;

  /* IDs de envio de todos os pedidos (para etiquetas) */
  const shippingIds = validOrders
    .map(({ data: o }) => String(o.shipping?.id ?? ""))
    .filter(Boolean);

  const created: { id: string; numero: number; marca: string }[] = [];

  for (const [marcaSlug, itemMap] of Object.entries(byMarca)) {
    const orderItems = Array.from(itemMap.values());
    const total = orderItems.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);

    const { data: orcamento, error: orcErr } = await db
      .from("orcamentos")
      .insert({
        cliente_id:         clienteRow.id,
        marca:              marcaSlug,
        tipo_pedido:        "dropshipping",
        condicao_pagamento: "semanal",
        status:             "enviado",
        total,
        ml_order_id:        novosIds[0],
        ml_shipping_id:     shippingIds[0] || null,
        observacoes,
      })
      .select("id, numero")
      .single();

    if (orcErr || !orcamento) continue;

    await db.from("orcamento_itens").insert(
      orderItems.map(i => ({ ...i, orcamento_id: orcamento.id }))
    );

    /* Salva etiquetas de todas as vendas agrupadas */
    for (const sid of shippingIds) {
      const labelUrl = await fetchTrackingUrl(sid, token);
      if (labelUrl) {
        void (async () => {
          try {
            await db.from("orcamento_etiquetas").insert({
              orcamento_id: orcamento.id,
              nome:         `Etiqueta ML envio #${sid}`,
              url:          labelUrl,
            });
          } catch { /* não bloqueia */ }
        })();
      }
    }

    created.push({ id: orcamento.id, numero: orcamento.numero, marca: marcaSlug });
  }

  if (!created.length) {
    return NextResponse.json({ error: "Não foi possível gerar o pedido" }, { status: 500 });
  }

  const avisoExistentes = existentesIds.length
    ? ` (${existentesIds.length} venda(s) já tinham pedido e foram ignoradas)`
    : "";

  return NextResponse.json({ ok: true, pedidos: created, aviso: avisoExistentes || undefined });
}
