import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendAccessRequestEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { marca_slug } = await request.json() as { marca_slug: string };
  if (!marca_slug) return NextResponse.json({ error: "marca_slug obrigatório" }, { status: 400 });

  const db = await createAdminClient();

  const { data: cliente } = await db
    .from("clientes")
    .select("id, razao_social, cnpj")
    .eq("user_id", user.id)
    .single();
  if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const { data: marca } = await db
    .from("marcas")
    .select("slug, name, email")
    .eq("slug", marca_slug)
    .eq("ativo", true)
    .single();
  if (!marca) return NextResponse.json({ error: "Marca não encontrada" }, { status: 404 });

  const { data: existing } = await db
    .from("marca_clientes")
    .select("status")
    .eq("marca_slug", marca_slug)
    .eq("cliente_id", cliente.id)
    .single();

  if (existing) {
    const msg =
      existing.status === "pendente" ? "Você já tem uma solicitação pendente para esta marca." :
      existing.status === "aprovado" ? "Você já tem acesso aprovado a esta marca."            :
                                        "Sua solicitação já foi registrada para esta marca.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const { error } = await db
    .from("marca_clientes")
    .insert({ marca_slug, cliente_id: cliente.id, status: "pendente" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (marca.email) {
    try {
      await sendAccessRequestEmail({
        marcaEmail:  marca.email as string,
        marcaNome:   marca.name as string,
        clienteNome: (cliente as { razao_social: string }).razao_social,
        clienteCnpj: (cliente as { cnpj: string }).cnpj,
      });
    } catch { /* email failure does not block action */ }
  }

  return NextResponse.json({ ok: true });
}
