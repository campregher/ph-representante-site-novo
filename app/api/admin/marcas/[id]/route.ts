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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const { id } = await params;
    const { name, segment, logo_url, ativo, razao_social, cnpj, email, telefone, contato, cep, logradouro, numero, complemento, bairro, cidade, estado } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("marcas")
      .update({
        name: name.trim(), segment: segment || null, logo_url: logo_url || null, ativo: ativo ?? true,
        razao_social: razao_social || null,
        cnpj: cnpj || null, email: email || null, telefone: telefone || null, contato: contato || null,
        cep: cep || null, logradouro: logradouro || null, numero: numero || null,
        complemento: complemento || null, bairro: bairro || null, cidade: cidade || null, estado: estado || null,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Registro não encontrado");
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const { id } = await params;
    const supabase = await createAdminClient();
    const { error } = await supabase.from("marcas").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}
