import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

interface MLItem {
  id:        string;
  title:     string;
  price:     number;
  status:    string;
  thumbnail: string;
  permalink: string;
}

async function fetchItemDetails(ids: string[], token: string): Promise<MLItem[]> {
  if (!ids.length) return [];
  /* ML aceita até 20 IDs por requisição */
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 20) chunks.push(ids.slice(i, i + 20));

  const results: MLItem[] = [];
  for (const chunk of chunks) {
    const res = await fetch(
      `${ML_BASE}/items?ids=${chunk.join(",")}&attributes=id,title,price,status,thumbnail,permalink`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) continue;
    const rows: { code: number; body: MLItem }[] = await res.json();
    for (const r of rows) {
      if (r.code === 200 && r.body?.id) results.push(r.body);
    }
  }
  return results;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const token = await getValidPortalToken(user.id).catch(() => null);
  if (!token) return NextResponse.json({ error: "Conta ML não conectada" }, { status: 403 });

  const db = await createAdminClient();

  /* ml_user_id do cliente */
  const { data: tokenRow } = await db
    .from("portal_ml_tokens")
    .select("ml_user_id")
    .eq("cliente_id", user.id)
    .single();

  if (!tokenRow?.ml_user_id)
    return NextResponse.json({ error: "Conta ML não encontrada" }, { status: 404 });

  const url = new URL(request.url);
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit  = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);

  /* busca IDs dos anúncios do vendedor */
  const searchRes = await fetch(
    `${ML_BASE}/users/${tokenRow.ml_user_id}/items/search?limit=${limit}&offset=${offset}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!searchRes.ok) {
    return NextResponse.json({ error: "Erro ao buscar anúncios no ML" }, { status: 502 });
  }
  const searchData: { results: string[]; paging: { total: number; limit: number; offset: number } } =
    await searchRes.json();

  const ids = searchData.results ?? [];

  /* busca detalhes */
  const items = await fetchItemDetails(ids, token);

  /* quais já estão vinculados no nosso banco */
  const { data: vinculados } = await db
    .from("portal_ml_anuncios")
    .select("ml_item_id, produto_id, marca_slug")
    .eq("cliente_id", user.id);

  const vinculadoMap: Record<string, { produto_id: string; marca_slug: string }> = {};
  for (const v of vinculados ?? []) {
    vinculadoMap[v.ml_item_id] = { produto_id: v.produto_id, marca_slug: v.marca_slug };
  }

  const anuncios = items.map(item => ({
    ...item,
    vinculado: !!vinculadoMap[item.id],
    produto_id:  vinculadoMap[item.id]?.produto_id  ?? null,
    marca_slug:  vinculadoMap[item.id]?.marca_slug  ?? null,
  }));

  return NextResponse.json({
    anuncios,
    paging: searchData.paging,
  });
}
