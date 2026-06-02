import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

async function isAdmin() {
  const store = await cookies();
  return await verifyToken(store.get(ADMIN_COOKIE)?.value ?? "");
}

function supabaseAdmin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data, error } = await supabaseAdmin()
    .from("clientes")
    .select("*, orcamentos(id, numero, status, status_pagamento, tipo_pedido, condicao_pagamento, prazo_boleto, transportadora, observacoes, total, marca, created_at, orcamento_itens(produto_sku, produto_nome, quantidade, valor_unitario, valor_total))")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, status, observacao_admin } = await request.json();
  const { error } = await supabaseAdmin().from("clientes").update({ status, observacao_admin }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
