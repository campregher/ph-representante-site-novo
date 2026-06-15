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
  const now = new Date();
  return now.getTime() - new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

async function fetchOrders(mlUserId: string, token: string): Promise<{ results: MLOrder[]; paging: { total: number } } | null> {
  /* tenta endpoint principal */
  const urls = [
    `${ML_BASE}/orders/search?seller=${mlUserId}&sort=date_desc&limit=100`,
    `${ML_BASE}/users/${mlUserId}/orders/search?sort=date_desc&limit=100`,
  ];

  for (const url of urls) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return res.json();
    const body = await res.text().catch(() => "");
    console.error("[ml/vendas] failed", url, res.status, body);
    if (res.status !== 403) return null; /* outro erro — para */
    /* 403 → tenta próximo endpoint */
  }
  return null; /* ambos falharam com 403 */
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

  const searchData = await fetchOrders(tokenRow.ml_user_id, token);

  if (!searchData) {
    /* diagnóstico: verifica escopos do token */
    let scopes     = "desconhecido";
    let checkRaw   = "";
    let meStatus   = 0;
    let meNickname = "";
    try {
      const checkRes = await fetch(`${ML_BASE}/oauth/check_token?token=${token}`);
      checkRaw = await checkRes.text();
      if (checkRes.ok) {
        const d = JSON.parse(checkRaw);
        scopes = d.scope ?? JSON.stringify(d);
      } else {
        scopes = `HTTP ${checkRes.status}: ${checkRaw.slice(0, 300)}`;
      }
    } catch (e) { scopes = `erro: ${e}`; }

    try {
      const meRes = await fetch(`${ML_BASE}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      meStatus = meRes.status;
      const meBody = await meRes.json().catch(() => ({}));
      meNickname = meBody.nickname ?? meBody.first_name ?? JSON.stringify(meBody).slice(0, 100);
    } catch { /* noop */ }

    console.error("[ml/vendas] diagnóstico:", { scopes, meStatus, meNickname, mlUserId: tokenRow.ml_user_id });

    return NextResponse.json({
      sem_permissao: true,
      error: "O aplicativo ML não tem permissão para acessar pedidos. Habilite Orders_v2 no ML Developers e reconecte a conta.",
      debug: { scopes, meStatus, meNickname },
    }, { status: 403 });
  }

  const allOrders = searchData.results ?? [];

  /* filtra pelo período e só pedidos pagos */
  const cutoff = Date.now() - periodoMs(periodo);
  const orders = allOrders.filter(o =>
    new Date(o.date_created).getTime() >= cutoff &&
    (o.status === "paid" || o.status === "payment_required" || o.status === "partially_paid")
  );

  /* anúncios vinculados */
  const { data: vinculados } = await db
    .from("portal_ml_anuncios")
    .select("ml_item_id, produto_id, marca_slug, preco_revenda")
    .eq("cliente_id", user.id);

  const vinculadoMap: Record<string, { produto_id: string; marca_slug: string; preco_revenda: number | null }> = {};
  for (const v of vinculados ?? []) vinculadoMap[v.ml_item_id] = v;

  type EnrichedOrder = {
    id: number; date_created: string; status: string; total_amount: number; buyer: string;
    items: { ml_item_id: string; title: string; quantity: number; unit_price: number; vinculado: boolean; produto_id: string | null; marca_slug: string | null }[];
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
        ml_item_id: i.item?.id ?? "", title: i.item?.title ?? "",
        quantity: i.quantity, unit_price: i.unit_price,
        vinculado: !!link, produto_id: link?.produto_id ?? null, marca_slug: link?.marca_slug ?? null,
      };
    }),
  }));

  const totalVendido = enriched.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalPedidos = enriched.length;
  const ticketMedio  = totalPedidos > 0 ? totalVendido / totalPedidos : 0;

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

  const ranking = Object.values(produtoTotais).sort((a, b) => b.total - a.total).slice(0, 10);

  return NextResponse.json({ periodo, totalVendido, totalPedidos, ticketMedio, ranking, orders: enriched, paging: searchData.paging });
}
