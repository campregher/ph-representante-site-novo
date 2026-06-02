import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");

  const db = await createAdminClient();

  let query = db
    .from("orcamentos")
    .select("id, numero, status, tipo_pedido, condicao_pagamento, prazo_boleto, total, created_at, horario_postagem, impresso_at, orcamento_itens(quantidade, valor_total), clientes(id, razao_social, cnpj, cidade, estado, email)")
    .eq("marca", ctx.marcaSlug)
    .order("created_at", { ascending: false });

  const validStatuses = ["enviado", "em_separacao", "a_pagar", "pago", "recusado"];
  if (statusFilter && statusFilter !== "todos" && validStatuses.includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
