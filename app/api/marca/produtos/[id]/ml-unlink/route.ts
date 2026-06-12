import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { getProductById } from "@/lib/produtos";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const product = await getProductById(id);
  if (!product)                        return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  if (product.brand !== ctx.marcaSlug) return NextResponse.json({ error: "Sem permissão" },         { status: 403 });

  const db = await createAdminClient();
  await db.from("produtos").update({
    ml_item_id:      null,
    ml_status:       null,
    ml_error:        null,
    ml_published_at: null,
  }).eq("id", id);

  return NextResponse.json({ ok: true });
}
