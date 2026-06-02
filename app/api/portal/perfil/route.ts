import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const db = await createAdminClient();
  const { data: rows, error } = await db
    .from("clientes")
    .select("razao_social, nome_fantasia, cnpj, inscricao_estadual, status, email, whatsapp, cep, logradouro, numero, complemento, bairro, cidade, estado, logo_url")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const data = rows?.[0] ?? null;
  if (error || !data) return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 404 });
  return NextResponse.json({ ...data, authEmail: user.email });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const {
    nome_fantasia, email, whatsapp,
    cep, logradouro, numero, complemento, bairro, cidade, estado,
  } = await request.json();

  if (!email?.trim())    return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });
  if (!whatsapp?.trim()) return NextResponse.json({ error: "WhatsApp obrigatório" }, { status: 400 });

  const db = await createAdminClient();
  const { error } = await db.from("clientes").update({
    nome_fantasia: nome_fantasia || null,
    email:         email.trim(),
    whatsapp:      whatsapp.trim(),
    cep:           cep        || null,
    logradouro:    logradouro || null,
    numero:        numero     || null,
    complemento:   complemento || null,
    bairro:        bairro     || null,
    cidade:        cidade     || null,
    estado:        estado     || null,
  }).eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
