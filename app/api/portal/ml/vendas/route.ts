import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

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
  order_items:  MLOrderItem[];
}

function periodoMs(periodo: string): number {
  if (periodo === "7d")  return 7  * 24 * 60 * 60 * 1000;
  if (periodo === "30d") return 30 * 24 * 60 * 60 * 1000;
  if (periodo === "90d") return 90 * 24 * 60 * 60 * 1000;
  /* mes: início do mês atual */
  const now = new Date();
  return now.getTime() - new Date(now.getFullYear(), now.getMonth(), 1).getTime();
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

  const url     = new URL(request.url);
  const periodo = url.searchParams.get("periodo") ?? "mes";

  /* busca pedidos pagos — sem filtro de data na URL para evitar rejeição da API */
  const mlUrl = `${ML_BASE}/orders/search?seller=${tokenRow.ml_user_id}&order.status=paid&sort=date_desc&limit=100`;

  const searchRes = await fetch(mlUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) {
    let errBody = "";
    try { errBody = await searchRes.text(); } catch { /* noop */ }
    console.error("[ml/vendas] ML API error", searchRes.status, errBody);
    return NextResponse.json(
      { error: `Erro ao buscar pedidos no ML (status ${searchRes.status})`, detail: errBody },
      { status: 502 }
    );
  }

  const searchData: { results: MLOrder[]; paging: { total: number } } = await searchRes.json();
  const allOrders = searchData.results ?? [];

  /* filtra pelo período no lado da aplicação */
  const cutoff = Date.now() - periodoMs(periodo);
  const orders = allOrders.filter(o => new Date(o.date_created).getTime() >= cutoff);

  /* anúncios vinculados deste cliente */
  const { data: vinculados } = await db
    .from("portal_ml_anuncios")
    .select("ml_item_id, produto_id, marca_slug, preco_revenda")
    .eq("cliente_id", user.id);

  const vinculadoMap: Record<string, { produto_id: string; marca_slug: string; preco_revenda: number | null }> = {};
  for (const v of vinculados ?? []) vinculadoMap[v.ml_item_id] = v;

  type EnrichedOrder = {
    id:           number;
    date_created: string;
    status:       string;
    total_amount: number;
    buyer:        string;
    items: {
      ml_item_id: string; title: string; quantity: number; unit_price: number;
      vinculado: boolean; produto_id: string | null; marca_slug: string | null;
    }[];
  };

  const enriched: EnrichedOrder[] = orders.map(o => ({
    id:           o.id,
    date_created: o.date_created,
    status:       o.status,
    total_amount: o.total_amount,
    buyer:        o.buyer?.nickname ?? "—",
    items: (o.order_items ?? []).map(i => {
      const link = vinculadoMap[i.item?.id ?? ""];
      return {
        ml_item_id:  i.item?.id    ?? "",
        title:       i.item?.title ?? "",
        quantity:    i.quantity,
        unit_price:  i.unit_price,
        vinculado:   !!link,
        produto_id:  link?.produto_id  ?? null,
        marca_slug:  link?.marca_slug  ?? null,
      };
    }),
  }));

  const totalVendido = enriched.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalPedidos = enriched.length;
  const ticketMedio  = totalPedidos > 0 ? totalVendido / totalPedidos : 0;

  /* ranking por anúncio vinculado */
  const produtoTotais: Record<string, { produto_id: string; marca_slug: string; titulo: string; qtd: number; total: number }> = {};
  for (const o of enriched) {
    for (const i of o.items) {
      if (!i.vinculado || !i.produto_id) continue;
      if (!produtoTotais[i.ml_item_id]) {
        produtoTotais[i.ml_item_id] = { produto_id: i.produto_id, marca_slug: i.marca_slug ?? "", titulo: i.title, qtd: 0, total: 0 };
      }
      produtoTotais[i.ml_item_id].qtd   += i.quantity;
      produtoTotais[i.ml_item_id].total += i.unit_price * i.quantity;
    }
  }

  const ranking = Object.values(produtoTotais)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return NextResponse.json({
    periodo,
    totalVendido,
    totalPedidos,
    ticketMedio,
    ranking,
    orders: enriched,
    paging: searchData.paging,
  });
}
