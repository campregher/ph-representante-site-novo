import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendInvoiceEmail } from "@/lib/email";

export const runtime = "nodejs";

function adminDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value ?? "";
  return verifyToken(token);
}

function orderTotal(o: { total: number; orcamento_itens?: { valor_total: number }[] }) {
  return Number(o.total) || (o.orcamento_itens ?? []).reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
}

// GET — list clients with pending payments
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = adminDb();

  const { data: orcamentos, error } = await db
    .from("orcamentos")
    .select("id, numero, status, status_pagamento, tipo_pedido, condicao_pagamento, prazo_boleto, transportadora, observacoes, marca, total, created_at, orcamento_itens(produto_sku, produto_nome, quantidade, valor_unitario, valor_total), clientes(id, razao_social, cnpj, email, bloqueado)")
    .eq("status", "finalizado")
    .neq("status_pagamento", "pago")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by cliente
  const map = new Map<string, {
    id: string; nome: string; cnpj: string; email: string; bloqueado: boolean;
    pedidos: typeof orcamentos;
    totalPendente: number;
    temAtrasado: boolean;
  }>();

  for (const o of orcamentos ?? []) {
    const c = o.clientes as unknown as { id: string; razao_social: string; cnpj: string; email: string; bloqueado: boolean } | null;
    if (!c) continue;
    if (!map.has(c.id)) {
      map.set(c.id, { id: c.id, nome: c.razao_social, cnpj: c.cnpj, email: c.email, bloqueado: c.bloqueado ?? false, pedidos: [], totalPendente: 0, temAtrasado: false });
    }
    const entry = map.get(c.id)!;
    entry.pedidos.push(o);
    entry.totalPendente += orderTotal(o);
    if ((o.status_pagamento ?? "em_aberto") === "atrasado") entry.temAtrasado = true;
  }

  const result = Array.from(map.values()).sort((a, b) => {
    if (a.temAtrasado !== b.temAtrasado) return a.temAtrasado ? -1 : 1;
    return b.totalPendente - a.totalPendente;
  });

  return NextResponse.json(result);
}

// POST — send invoice email
export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { clienteId, orcamentoIds, mensagem } = await request.json();
  if (!clienteId) return NextResponse.json({ error: "clienteId obrigatório" }, { status: 400 });

  const db = adminDb();

  const { data: cliente } = await db
    .from("clientes")
    .select("id, razao_social, cnpj, email")
    .eq("id", clienteId)
    .single();

  if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  let query = db
    .from("orcamentos")
    .select("id, numero, status_pagamento, condicao_pagamento, prazo_boleto, marca, total, created_at")
    .eq("status", "finalizado")
    .eq("cliente_id", clienteId);

  if (orcamentoIds?.length) {
    query = query.in("id", orcamentoIds);
  } else {
    query = query.neq("status_pagamento", "pago");
  }

  const { data: pedidos } = await query.order("created_at", { ascending: true });

  if (!pedidos?.length) return NextResponse.json({ error: "Nenhum pedido encontrado" }, { status: 404 });

  try {
    await sendInvoiceEmail({
      clienteEmail: cliente.email,
      clienteNome:  cliente.razao_social,
      clienteCnpj:  cliente.cnpj,
      pedidos:      pedidos as Parameters<typeof sendInvoiceEmail>[0]["pedidos"],
      mensagem,
    });
    return NextResponse.json({ ok: true, enviados: pedidos.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao enviar email" }, { status: 500 });
  }
}

// PATCH — block/unblock client
export async function PATCH(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { clienteId, bloqueado } = await request.json();
  if (!clienteId || typeof bloqueado !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const db = adminDb();
  const { error } = await db.from("clientes").update({ bloqueado }).eq("id", clienteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
