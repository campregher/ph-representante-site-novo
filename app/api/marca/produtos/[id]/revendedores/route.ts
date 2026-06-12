import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { getProductById } from "@/lib/produtos";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  if (product.brand !== ctx.marcaSlug) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const db = await createAdminClient();

  const { data: anuncios } = await db
    .from("portal_ml_anuncios")
    .select("cliente_id, ml_item_id, ml_status, preco_revenda, updated_at")
    .eq("produto_id", id)
    .order("updated_at", { ascending: false });

  if (!anuncios?.length) return NextResponse.json({ revendedores: [] });

  /* busca nicknames ML dos clientes */
  const clienteIds = anuncios.map(a => a.cliente_id);
  const { data: tokens } = await db
    .from("portal_ml_tokens")
    .select("cliente_id, ml_nickname, ml_user_id")
    .in("cliente_id", clienteIds);

  const tokenMap: Record<string, { ml_nickname: string; ml_user_id: string }> = {};
  for (const t of tokens ?? []) {
    tokenMap[t.cliente_id] = { ml_nickname: t.ml_nickname, ml_user_id: t.ml_user_id };
  }

  const revendedores = anuncios.map(a => ({
    cliente_id:    a.cliente_id,
    ml_nickname:   tokenMap[a.cliente_id]?.ml_nickname ?? null,
    ml_user_id:    tokenMap[a.cliente_id]?.ml_user_id  ?? null,
    ml_item_id:    a.ml_item_id,
    ml_status:     a.ml_status,
    preco_revenda: a.preco_revenda,
    updated_at:    a.updated_at,
  }));

  return NextResponse.json({ revendedores });
}
