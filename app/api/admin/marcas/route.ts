import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value ?? "";
  return await verifyToken(token);
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("marcas")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return NextResponse.json(data ?? []);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const { slug, name, segment, logo_url, ativo, razao_social, cnpj, email, telefone, contato, cep, logradouro, numero, complemento, bairro, cidade, estado } = await request.json();
    if (!slug?.trim()) return NextResponse.json({ error: "Slug obrigatório" }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("marcas")
      .insert({
        slug: slug.trim().toLowerCase(), name: name.trim(),
        segment: segment || null, logo_url: logo_url || null, ativo: ativo ?? true,
        razao_social: razao_social || null,
        cnpj: cnpj || null, email: email || null, telefone: telefone || null, contato: contato || null,
        cep: cep || null, logradouro: logradouro || null, numero: numero || null,
        complemento: complemento || null, bairro: bairro || null, cidade: cidade || null, estado: estado || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}
