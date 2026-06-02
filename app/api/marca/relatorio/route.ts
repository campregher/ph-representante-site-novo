import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function orderTotal(o: { total: number; orcamento_itens?: { valor_total: number }[] }) {
  return Number(o.total) || (o.orcamento_itens ?? []).reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
}

export async function GET() {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = await createAdminClient();

  const { data: orders } = await db
    .from("orcamentos")
    .select("id, status, status_pagamento, total, created_at, orcamento_itens(valor_total)")
    .eq("marca", ctx.marcaSlug)
    .order("created_at", { ascending: false });

  const all          = orders ?? [];
  const finalizados  = all.filter((o) => o.status === "finalizado");
  const aprovados    = all.filter((o) => o.status === "aprovado");
  const enviados     = all.filter((o) => o.status === "enviado");
  const recusados    = all.filter((o) => o.status === "recusado");

  const pago     = finalizados.filter((o) => o.status_pagamento === "pago").reduce((s, o) => s + orderTotal(o), 0);
  const emAberto = finalizados.filter((o) => (o.status_pagamento ?? "em_aberto") === "em_aberto").reduce((s, o) => s + orderTotal(o), 0);
  const atrasado = finalizados.filter((o) => o.status_pagamento === "atrasado").reduce((s, o) => s + orderTotal(o), 0);
  const totalFaturado = pago + emAberto + atrasado;

  // Monthly breakdown (last 12 months)
  const monthly: Record<string, { total: number; pedidos: number }> = {};
  for (const o of finalizados) {
    const key = o.created_at.slice(0, 7); // YYYY-MM
    if (!monthly[key]) monthly[key] = { total: 0, pedidos: 0 };
    monthly[key].total   += orderTotal(o);
    monthly[key].pedidos += 1;
  }
  const porMes = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([mes, d]) => ({ mes, ...d }));

  return NextResponse.json({
    totalPedidos:  all.length,
    enviados:      enviados.length,
    aprovados:     aprovados.length,
    finalizados:   finalizados.length,
    recusados:     recusados.length,
    totalFaturado,
    pago,
    emAberto,
    atrasado,
    porMes,
  });
}
