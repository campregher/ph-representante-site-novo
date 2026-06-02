import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: cliente } = await supabase
    .from("clientes").select("id, status").eq("user_id", user.id).single();

  if (!cliente || cliente.status !== "aprovado") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { data: orders } = await supabase
    .from("orcamentos")
    .select("id, numero, status, status_pagamento, marca, total, condicao_pagamento, prazo_boleto, created_at, orcamento_itens(valor_total, quantidade)")
    .eq("cliente_id", cliente.id)
    .order("created_at", { ascending: false });

  const slugs = [...new Set((orders ?? []).map((o) => o.marca).filter(Boolean))] as string[];
  const { data: marcas } = slugs.length
    ? await supabase.from("marcas").select("slug, name, logo_url").in("slug", slugs)
    : { data: [] };

  const brands = Object.fromEntries((marcas ?? []).map((m: { slug: string; name: string; logo_url: string | null }) => [m.slug, m]));

  return NextResponse.json({ orders: orders ?? [], brands });
}
