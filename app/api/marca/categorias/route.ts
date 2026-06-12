import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = await createAdminClient();
  const { data, error } = await db
    .from("categorias")
    .select("*")
    .order("nome", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { nome, descricao, ml_category_id, ml_category_name, ml_category_path } = body;

  if (!nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const slug = nome.trim()
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const db = await createAdminClient();
  const { data, error } = await db
    .from("categorias")
    .insert({
      nome:               nome.trim(),
      slug,
      descricao:          descricao?.trim() ?? null,
      ml_category_id:     ml_category_id    ?? null,
      ml_category_name:   ml_category_name  ?? null,
      ml_category_path:   ml_category_path  ?? null,
      ativa:              true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
