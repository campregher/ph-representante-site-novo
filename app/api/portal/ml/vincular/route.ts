import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();

  const isBatch = Array.isArray(body.items);
  const items: { produto_id: string; ml_item_id: string; preco_revenda?: number }[] = isBatch
    ? body.items
    : [{ produto_id: body.produto_id, ml_item_id: body.ml_item_id, preco_revenda: body.preco_revenda }];

  if (!items.length) return NextResponse.json({ error: "Nenhum item" }, { status: 400 });

  const db    = await createAdminClient();
  const token = await getValidPortalToken(user.id).catch(() => null);
  if (!token) return NextResponse.json({ error: "Conecte sua conta do Mercado Livre primeiro" }, { status: 403 });

  const { data: tokenRow } = await db
    .from("portal_ml_tokens")
    .select("ml_user_id")
    .eq("cliente_id", user.id)
    .single();

  const results: { produto_id: string; ml_item_id: string; ok: boolean; error?: string }[] = [];

  for (const item of items) {
    if (!item.produto_id || !item.ml_item_id) {
      results.push({ ...item, ok: false, error: "produto_id e ml_item_id obrigatórios" });
      continue;
    }

    try {
      /* busca detalhes do anúncio no ML (best-effort — não bloqueia se falhar) */
      let mlStatus = "active";
      let mlPrice  = 0;
      try {
        const mlRes = await fetch(`${ML_BASE}/items/${item.ml_item_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (mlRes.ok) {
          const mlItem = await mlRes.json();
          /* valida que o anúncio pertence à conta */
          if (tokenRow?.ml_user_id && String(mlItem.seller_id) !== String(tokenRow.ml_user_id)) {
            results.push({ ...item, ok: false, error: "Anúncio não pertence à sua conta ML" });
            continue;
          }
          mlStatus = mlItem.status ?? "active";
          mlPrice  = mlItem.price ?? 0;
        }
      } catch { /* ignora erro de rede — salva o vínculo mesmo assim */ }

      const { data: product } = await db
        .from("produtos")
        .select("brand, resale_price, price")
        .eq("id", item.produto_id)
        .single();

      const preco = item.preco_revenda ?? product?.resale_price ?? product?.price ?? mlPrice ?? 0;

      /* remove vínculo anterior APENAS deste ml_item_id (não por produto_id —
         isso causaria deleção em cascata quando o mesmo produto é vinculado
         a múltiplos anúncios num batch) */
      await db.from("portal_ml_anuncios")
        .delete()
        .eq("cliente_id", user.id)
        .eq("ml_item_id", item.ml_item_id);

      const { error: insertErr } = await db.from("portal_ml_anuncios").insert({
        cliente_id:    user.id,
        produto_id:    item.produto_id,
        marca_slug:    product?.brand ?? "",
        ml_item_id:    item.ml_item_id,
        ml_status:     mlStatus,
        preco_revenda: preco,
        updated_at:    new Date().toISOString(),
      });

      if (insertErr) throw new Error(insertErr.message);

      results.push({ ...item, ok: true });
    } catch (e) {
      console.error("[vincular]", item.ml_item_id, e);
      results.push({ ...item, ok: false, error: e instanceof Error ? e.message : "Erro" });
    }
  }

  if (!isBatch) {
    const r = results[0];
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
    return NextResponse.json({ ok: true, ml_item_id: r.ml_item_id });
  }

  return NextResponse.json({ results });
}
