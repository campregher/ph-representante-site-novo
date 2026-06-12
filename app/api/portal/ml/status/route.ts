import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const db = await createAdminClient();

  const [tokenRes, anunciosRes] = await Promise.all([
    db.from("portal_ml_tokens")
      .select("ml_user_id, ml_nickname, expires_at")
      .eq("cliente_id", user.id)
      .maybeSingle(),

    db.from("portal_ml_anuncios")
      .select("id, produto_id, marca_slug, ml_item_id, ml_status, preco_revenda, created_at")
      .eq("cliente_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const connected = !!tokenRes.data;
  const anuncios  = anunciosRes.data ?? [];

  /* enrich with product name + thumbnail */
  const produtoIds = [...new Set(anuncios.map(a => a.produto_id).filter(Boolean))];
  let produtoMap: Record<string, { name: string; thumbnail: string | null }> = {};

  if (produtoIds.length > 0) {
    const { data: prods } = await db
      .from("produtos")
      .select("id, name, images")
      .in("id", produtoIds);

    for (const p of prods ?? []) {
      produtoMap[p.id] = {
        name:      p.name,
        thumbnail: Array.isArray(p.images) && p.images[0] ? p.images[0] : null,
      };
    }
  }

  const anunciosEnriquecidos = anuncios.map(a => ({
    ...a,
    produto_name:      produtoMap[a.produto_id]?.name      ?? null,
    produto_thumbnail: produtoMap[a.produto_id]?.thumbnail ?? null,
  }));

  return NextResponse.json({
    connected,
    ml_user_id:  tokenRes.data?.ml_user_id  ?? null,
    ml_nickname: tokenRes.data?.ml_nickname  ?? null,
    expires_at:  tokenRes.data?.expires_at   ?? null,
    anuncios:    anunciosEnriquecidos,
  });
}
