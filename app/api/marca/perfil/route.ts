import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = await createAdminClient();
  const { data, error } = await db
    .from("marcas")
    .select("slug, name, razao_social, cnpj, email, email_expedicao, telefone, contato, cep, logradouro, numero, complemento, bairro, cidade, estado, logo_url, segment, ml_user_id, ml_token_expires_at, ml_nickname")
    .eq("slug", ctx.marcaSlug)
    .single();

  if (error || !data) return NextResponse.json({ error: "Marca não encontrada" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const { name, razao_social, cnpj, email, email_expedicao, telefone, contato, cep, logradouro, numero, complemento, bairro, cidade, estado, logo_url } = body;

  const db = await createAdminClient();
  const { error } = await db
    .from("marcas")
    .update({
      name:             name             || null,
      razao_social:     razao_social     || null,
      cnpj:             cnpj             || null,
      email:            email            || null,
      email_expedicao:  email_expedicao  || null,
      telefone:         telefone         || null,
      contato:          contato          || null,
      cep:              cep              || null,
      logradouro:       logradouro       || null,
      numero:           numero           || null,
      complemento:      complemento      || null,
      bairro:           bairro           || null,
      cidade:           cidade           || null,
      estado:           estado           || null,
      logo_url:         logo_url         || null,
    })
    .eq("slug", ctx.marcaSlug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
