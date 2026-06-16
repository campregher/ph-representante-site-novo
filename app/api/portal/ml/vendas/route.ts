import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

/* Statuses de envio que significam "já finalizado" — todos os outros aparecem */
const SHIPPING_FINALIZADO = ["shipped", "delivered", "cancelled", "not_delivered", "return_expired", "lost"];

interface MLOrderItem {
  item:       { id: string; title: string; seller_sku?: string };
  quantity:   number;
  unit_price: number;
}

interface MLOrder {
  id:           number;
  date_created: string;
  status:       string;
  total_amount: number;
  buyer:        { nickname: string };
  shipping:     { id: number; status: string; substatus?: string } | null;
  order_items:  MLOrderItem[];
}

type FetchOrdersResult =
  | { ok: true;  data: { results: MLOrder[]; paging: { total: number } } }
  | { ok: false; status: number; body: string };

async function fetchOrders(mlUserId: string, token: string): Promise<FetchOrdersResult> {
  // Sem filtro de order.status — o ML transiciona o status de forma não-documentada
  // ao longo do ciclo de vida (paid → outros). Filtramos pelo shipping.status no servidor.
  const res = await fetch(
    `${ML_BASE}/orders/search?seller=${mlUserId}&sort=date_desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.ok) return { ok: true, data: await res.json() };
  const body = await res.text().catch(() => "");
  console.error("[ml/vendas] orders/search failed", res.status, body.slice(0, 300));
  return { ok: false, status: res.status, body };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const token = await getValidPortalToken(user.id).catch(() => null);
  if (!token) return NextResponse.json({ error: "Conta ML não conectada" }, { status: 403 });

  const db = await createAdminClient();

  const { data: tokenRow } = await db
    .from("portal_ml_tokens")
    .select("ml_user_id")
    .eq("cliente_id", user.id)
    .single();

  if (!tokenRow?.ml_user_id)
    return NextResponse.json({ error: "Conta ML não encontrada" }, { status: 404 });

  const result = await fetchOrders(tokenRow.ml_user_id, token);

  if (!result.ok) {
    if (result.status === 403) {
      return NextResponse.json({
        sem_permissao: true,
        error: "O aplicativo ML não tem permissão para acessar pedidos. Habilite Orders_v2 no ML Developers e reconecte a conta.",
      }, { status: 403 });
    }
    if (result.status === 401) {
      return NextResponse.json(
        { error: "Token ML inválido. Desconecte e reconecte sua conta Mercado Livre." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: `Erro ao buscar pedidos no Mercado Livre (${result.status})` },
      { status: 502 }
    );
  }

  const allOrders = result.data.results ?? [];

  /* Mantém só pedidos com envio ML ainda não concluído */
  const orders = allOrders.filter(o => {
    if (!o.shipping?.id) return false;
    const shStatus = o.shipping.status ?? "";
    return !SHIPPING_FINALIZADO.includes(shStatus);
  });

  /* Anúncios vinculados */
  const { data: vinculados } = await db
    .from("portal_ml_anuncios")
    .select("ml_item_id, produto_id, marca_slug, preco_revenda")
    .eq("cliente_id", user.id);

  const vinculadoMap: Record<string, { produto_id: string; marca_slug: string; preco_revenda: number | null }> = {};
  for (const v of vinculados ?? []) vinculadoMap[v.ml_item_id] = v;

  type PedidoResumo = {
    id: string; numero: number; status: string;
    etiquetas: { id: string; nome: string; url: string }[];
  };

  type EnrichedOrder = {
    id:              number;
    date_created:    string;
    status:          string;
    total_amount:    number;
    buyer:           string;
    shipping_id:     string;
    shipping_status: string;
    items:           { ml_item_id: string; title: string; quantity: number; unit_price: number; vinculado: boolean; produto_id: string | null; marca_slug: string | null }[];
    pedidos:         PedidoResumo[];
  };

  const enriched: EnrichedOrder[] = orders.map(o => ({
    id:              o.id,
    date_created:    o.date_created,
    status:          o.status,
    total_amount:    o.total_amount,
    buyer:           o.buyer?.nickname ?? "—",
    shipping_id:     String(o.shipping!.id),
    shipping_status: o.shipping!.status,
    pedidos:         [],
    items: (o.order_items ?? []).map(i => {
      const link = vinculadoMap[i.item?.id ?? ""];
      return {
        ml_item_id: i.item?.id ?? "",
        title:      i.item?.title ?? "",
        quantity:   i.quantity,
        unit_price: i.unit_price,
        vinculado:  !!link,
        produto_id: link?.produto_id ?? null,
        marca_slug: link?.marca_slug ?? null,
      };
    }),
  }));

  /* Busca pedidos da plataforma vinculados a estes orders ML */
  const mlOrderIds = enriched.map(o => String(o.id));
  if (mlOrderIds.length) {
    const { data: clienteRow } = await db
      .from("clientes")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (clienteRow) {
      const { data: orcamentos } = await db
        .from("orcamentos")
        .select("id, numero, status, ml_order_id, orcamento_etiquetas(id, nome, url)")
        .in("ml_order_id", mlOrderIds)
        .eq("cliente_id", clienteRow.id);

      const pedidosByOrder: Record<string, PedidoResumo[]> = {};
      for (const orc of orcamentos ?? []) {
        if (!orc.ml_order_id) continue;
        if (!pedidosByOrder[orc.ml_order_id]) pedidosByOrder[orc.ml_order_id] = [];
        pedidosByOrder[orc.ml_order_id].push({
          id:        orc.id,
          numero:    orc.numero,
          status:    orc.status,
          etiquetas: (orc.orcamento_etiquetas ?? []) as { id: string; nome: string; url: string }[],
        });
      }

      for (const o of enriched) {
        o.pedidos = pedidosByOrder[String(o.id)] ?? [];
      }
    }
  }

  const totalPedidos = enriched.length;
  const totalValor   = enriched.reduce((s, o) => s + Number(o.total_amount), 0);

  return NextResponse.json({ totalPedidos, totalValor, orders: enriched });
}
