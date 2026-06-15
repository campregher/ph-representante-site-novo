import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";
import { sendAccessStatusEmail } from "@/lib/email";

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

  const db = supabaseAdmin();
  const { error } = await db.from("clientes").update({ status, observacao_admin }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === "aprovado" || status === "recusado") {
    const { data: cliente } = await db
      .from("clientes")
      .select("email, razao_social")
      .eq("id", id)
      .single();

    if (cliente?.email) {
      sendAccessStatusEmail({
        clienteEmail: cliente.email as string,
        clienteNome:  cliente.razao_social as string,
        marcaNome:    "PH Representante",
        action:       status as "aprovado" | "recusado",
        observacao:   observacao_admin ?? null,
      }).catch((e) => console.error("[email-admin-status]", e));
    }
  }

  return NextResponse.json({ ok: true });
}
