import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = await createAdminClient();

  const { data, error } = await db
    .from("orcamentos")
    .select(`
      id, numero, status, tipo_pedido,
      condicao_pagamento, prazo_boleto,
      total, created_at,
      orcamento_itens(quantidade, valor_total),
      clientes(razao_social, cnpj, cidade, estado)
    `)
    .eq("marca", ctx.marcaSlug)
    .in("status", ["a_pagar", "pago", "recusado"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
