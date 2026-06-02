import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";
import { sendPaymentConfirmationEmail } from "@/lib/email";

export const runtime = "nodejs";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value ?? "";
  return await verifyToken(token);
}

function adminDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const supabase = adminDb();
    const { data, error } = await supabase
      .from("orcamentos")
      .select("id, numero, status, status_pagamento, tipo_pedido, condicao_pagamento, prazo_boleto, transportadora, observacoes, marca, total, created_at, orcamento_itens(produto_sku, produto_nome, quantidade, valor_unitario, valor_total), clientes(id, razao_social, cnpj, cidade, estado, email)")
      .in("status", ["aprovado", "finalizado"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const { id, status_pagamento } = await request.json();
    if (!id || !status_pagamento) return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    const supabase = adminDb();

    // Fetch order + client before updating to detect pago transition
    const { data: existing } = await supabase
      .from("orcamentos")
      .select("numero, status_pagamento, marca, total, clientes(razao_social, email)")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("orcamentos").update({ status_pagamento }).eq("id", id);
    if (error) throw new Error(error.message);

    // Send payment confirmation email when marking as pago
    if (status_pagamento === "pago" && existing?.status_pagamento !== "pago") {
      const cliente = existing?.clientes as unknown as { razao_social: string; email: string } | null;
      if (cliente?.email) {
        try {
          await sendPaymentConfirmationEmail({
            numero:       existing!.numero,
            clienteEmail: cliente.email,
            clienteNome:  cliente.razao_social,
            marca:        existing!.marca ?? undefined,
            total:        Number(existing!.total ?? 0),
          });
        } catch { /* email failure should not break the status update */ }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}
