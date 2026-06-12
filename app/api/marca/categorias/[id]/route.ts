import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const db = await createAdminClient();
  const { data, error } = await db
    .from("categorias")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { nome, descricao, ativa, ml_category_id, ml_category_name, ml_category_path } = body;

  const patch: Record<string, unknown> = {};
  if (nome              !== undefined) patch.nome               = nome.trim();
  if (descricao         !== undefined) patch.descricao          = descricao?.trim() ?? null;
  if (ativa             !== undefined) patch.ativa              = ativa;
  if (ml_category_id    !== undefined) patch.ml_category_id    = ml_category_id    ?? null;
  if (ml_category_name  !== undefined) patch.ml_category_name  = ml_category_name  ?? null;
  if (ml_category_path  !== undefined) patch.ml_category_path  = ml_category_path  ?? null;

  if (nome !== undefined) {
    patch.slug = nome.trim()
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  const db = await createAdminClient();
  const { data, error } = await db
    .from("categorias")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const db = await createAdminClient();
  const { error } = await db.from("categorias").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
