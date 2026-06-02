import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendWeeklyBillingEmail } from "@/lib/email";

export const runtime = "nodejs";

// Vercel Cron: toda sexta às 09:00 BRT (12:00 UTC)
// vercel.json: { "crons": [{ "path": "/api/cron/cobranca-semanal", "schedule": "0 12 * * 5" }] }

function weekLabel(fromDate: Date) {
  const d   = new Date(fromDate);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d); mon.setDate(d.getDate() + diff); mon.setHours(0, 0, 0, 0);
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
  return `${mon.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${fri.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
}

function orderWeekKey(createdAt: string) {
  const d   = new Date(createdAt);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d); mon.setDate(d.getDate() + diff); mon.setHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth   = request.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await createAdminClient();

  // Busca todos os pedidos semanal a_pagar de todas as marcas
  const { data: orders, error } = await db
    .from("orcamentos")
    .select("id, numero, created_at, total, marca, cliente_id, condicao_pagamento, orcamento_itens(valor_total), clientes(id, razao_social, email)")
    .eq("status", "a_pagar")
    .eq("condicao_pagamento", "semanal");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!orders?.length) return NextResponse.json({ ok: true, enviados: 0 });

  // Busca nomes das marcas de uma vez
  const marcaSlugs = [...new Set(orders.map(o => o.marca).filter(Boolean))] as string[];
  const { data: marcas } = await db.from("marcas").select("slug, name").in("slug", marcaSlugs);
  const marcaNameMap = Object.fromEntries((marcas ?? []).map(m => [m.slug, m.name]));

  // Agrupa por (marca, cliente, semana)
  type GroupKey = string; // `${marca}::${clienteId}::${weekKey}`
  const groups = new Map<GroupKey, {
    marcaSlug:    string;
    marcaNome:    string;
    clienteEmail: string;
    clienteNome:  string;
    weekLabel:    string;
    pedidos:      { numero: number; created_at: string; total: number }[];
    total:        number;
  }>();

  for (const o of orders) {
    const cliente = o.clientes as unknown as { id: string; razao_social: string; email: string } | null;
    if (!cliente?.email || !o.marca) continue;

    const wk  = orderWeekKey(o.created_at);
    const key: GroupKey = `${o.marca}::${cliente.id}::${wk}`;
    const tot = Number(o.total) || (o.orcamento_itens ?? []).reduce((s: number, i: { valor_total: number }) => s + Number(i.valor_total ?? 0), 0);

    if (!groups.has(key)) {
      groups.set(key, {
        marcaSlug:    o.marca,
        marcaNome:    marcaNameMap[o.marca] ?? o.marca,
        clienteEmail: cliente.email,
        clienteNome:  cliente.razao_social,
        weekLabel:    weekLabel(new Date(o.created_at)),
        pedidos:      [],
        total:        0,
      });
    }

    const g = groups.get(key)!;
    g.pedidos.push({ numero: o.numero, created_at: o.created_at, total: tot });
    g.total += tot;
  }

  let enviados = 0;
  const erros: string[] = [];

  for (const g of groups.values()) {
    try {
      await sendWeeklyBillingEmail({
        clienteEmail: g.clienteEmail,
        clienteNome:  g.clienteNome,
        brandName:    g.marcaNome,
        weekLabel:    g.weekLabel,
        pedidos:      g.pedidos,
        total:        g.total,
      });
      enviados++;
    } catch (e) {
      erros.push(`${g.marcaSlug}/${g.clienteEmail}: ${String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, enviados, erros: erros.length ? erros : undefined });
}
