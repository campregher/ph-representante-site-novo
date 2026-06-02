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

  // Semanal orders that are shipped and awaiting payment
  const { data: orders, error } = await db
    .from("orcamentos")
    .select("id, numero, status, condicao_pagamento, prazo_boleto, total, created_at, orcamento_itens(produto_sku, produto_nome, quantidade, valor_unitario, valor_total), clientes(id, razao_social, cnpj, email, bloqueado)")
    .eq("marca", ctx.marcaSlug)
    .eq("status", "a_pagar")
    .eq("condicao_pagamento", "semanal")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by cliente, then by week
  const clienteMap = new Map<string, {
    id: string; nome: string; cnpj: string; email: string; bloqueado: boolean;
    semanas: Map<string, { label: string; pedidos: typeof orders; total: number }>;
    totalPendente: number;
  }>();

  for (const o of orders ?? []) {
    const c = o.clientes as unknown as { id: string; razao_social: string; cnpj: string; email: string; bloqueado: boolean } | null;
    if (!c) continue;

    if (!clienteMap.has(c.id)) {
      clienteMap.set(c.id, { id: c.id, nome: c.razao_social, cnpj: c.cnpj, email: c.email, bloqueado: c.bloqueado ?? false, semanas: new Map(), totalPendente: 0 });
    }
    const entry = clienteMap.get(c.id)!;
    const tot = orderTotal(o);
    entry.totalPendente += tot;

    // Compute week key (Mon–Sun)
    const d = new Date(o.created_at);
    const dow = d.getDay(); // 0=Sun
    const diff = dow === 0 ? -6 : 1 - dow; // back to Monday
    const mon = new Date(d); mon.setDate(d.getDate() + diff); mon.setHours(0,0,0,0);
    const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
    const wk = mon.toISOString().slice(0,10);
    const label = `${mon.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${fri.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;

    if (!entry.semanas.has(wk)) {
      entry.semanas.set(wk, { label, pedidos: [], total: 0 });
    }
    const sem = entry.semanas.get(wk)!;
    sem.pedidos.push(o);
    sem.total += tot;
  }

  const result = Array.from(clienteMap.values()).map((e) => ({
    ...e,
    semanas: Array.from(e.semanas.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([wk, s]) => ({ semana: wk, label: s.label, pedidos: s.pedidos, total: s.total })),
  })).sort((a, b) => b.totalPendente - a.totalPendente);

  return NextResponse.json(result);
}
