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

  /* período: padrão = mês atual */
  const url      = new URL(request.url);
  const periodo  = url.searchParams.get("periodo") ?? "mes";

  const now   = new Date();
  let dateFrom: string;
  if (periodo === "7d") {
    const d = new Date(now); d.setDate(d.getDate() - 7);
    dateFrom = d.toISOString();
  } else if (periodo === "30d") {
    const d = new Date(now); d.setDate(d.getDate() - 30);
    dateFrom = d.toISOString();
  } else if (periodo === "90d") {
    const d = new Date(now); d.setDate(d.getDate() - 90);
    dateFrom = d.toISOString();
  } else {
    /* mês atual */
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  /* busca pedidos pagos no ML */
  const searchRes = await fetch(
    `${ML_BASE}/orders/search?seller=${tokenRow.ml_user_id}&order.status=paid&sort=date_desc&limit=50&date_created.from=${encodeURIComponent(dateFrom)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!searchRes.ok) {
    const err = await searchRes.text().catch(() => "");
    console.error("[ml/vendas] ML API error", searchRes.status, err);
    return NextResponse.json({ error: "Erro ao buscar pedidos no ML" }, { status: 502 });
  }

  const searchData: { results: MLOrder[]; paging: { total: number } } = await searchRes.json();
  const orders = searchData.results ?? [];

  /* anúncios vinculados deste cliente */
  const { data: vinculados } = await db
    .from("portal_ml_anuncios")
    .select("ml_item_id, produto_id, marca_slug, preco_revenda")
    .eq("cliente_id", user.id);

  const vinculadoMap: Record<string, { produto_id: string; marca_slug: string; preco_revenda: number | null }> = {};
  for (const v of vinculados ?? []) vinculadoMap[v.ml_item_id] = v;

  /* enrich orders com info do produto vinculado */
  type EnrichedOrder = {
    id:           number;
    date_created: string;
    status:       string;
    total_amount: number;
    buyer:        string;
    items: {
      ml_item_id:   string;
      title:        string;
      quantity:     number;
      unit_price:   number;
      vinculado:    boolean;
      produto_id:   string | null;
      marca_slug:   string | null;
    }[];
  };

  const enriched: EnrichedOrder[] = orders.map(o => ({
    id:           o.id,
    date_created: o.date_created,
    status:       o.status,
    total_amount: o.total_amount,
    buyer:        o.buyer?.nickname ?? "—",
    items: o.order_items.map(i => {
      const link = vinculadoMap[i.item.id];
      return {
        ml_item_id:  i.item.id,
        title:       i.item.title,
        quantity:    i.quantity,
        unit_price:  i.unit_price,
        vinculado:   !!link,
        produto_id:  link?.produto_id  ?? null,
        marca_slug:  link?.marca_slug  ?? null,
      };
    }),
  }));

  /* totais */
  const totalVendido    = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalPedidos    = orders.length;
  const ticketMedio     = totalPedidos > 0 ? totalVendido / totalPedidos : 0;

  /* ranking por produto (somente vinculados) */
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
    dateFrom,
    totalVendido,
    totalPedidos,
    ticketMedio,
    ranking,
    orders: enriched,
    paging: searchData.paging,
  });
}
