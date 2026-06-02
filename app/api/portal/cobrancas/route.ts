import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const db = await createAdminClient();

  const { data: cliente } = await db
    .from("clientes")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const { data: orders, error } = await db
    .from("orcamentos")
    .select("id, numero, status, marca, condicao_pagamento, total, created_at, orcamento_itens(valor_total)")
    .eq("cliente_id", cliente.id)
    .eq("status", "a_pagar")
    .eq("condicao_pagamento", "semanal")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch brand names
  const marcaSlugs = [...new Set((orders ?? []).map((o) => o.marca).filter(Boolean) as string[])];
  const { data: marcas } = marcaSlugs.length > 0
    ? await db.from("marcas").select("slug, name").in("slug", marcaSlugs)
    : { data: [] };
  const marcaMap = Object.fromEntries((marcas ?? []).map((m) => [m.slug, m.name]));

  // Group by marca, then by week
  const marcaMap2 = new Map<string, {
    slug: string; nome: string;
    semanas: Map<string, { label: string; pedidos: typeof orders; total: number }>;
    totalPendente: number;
  }>();

  for (const o of orders ?? []) {
    const slug = o.marca ?? "geral";
    const nome = marcaMap[slug] ?? slug;
    if (!marcaMap2.has(slug)) {
      marcaMap2.set(slug, { slug, nome, semanas: new Map(), totalPendente: 0 });
    }
    const entry = marcaMap2.get(slug)!;
    const tot = Number(o.total) || (o.orcamento_itens ?? []).reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
    entry.totalPendente += tot;

    const d = new Date(o.created_at);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(d); mon.setDate(d.getDate() + diff); mon.setHours(0,0,0,0);
    const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
    const wk = mon.toISOString().slice(0,10);
    const label = `${mon.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${fri.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;

    if (!entry.semanas.has(wk)) entry.semanas.set(wk, { label, pedidos: [], total: 0 });
    const sem = entry.semanas.get(wk)!;
    sem.pedidos.push(o);
    sem.total += tot;
  }

  const result = Array.from(marcaMap2.values()).map((e) => ({
    ...e,
    semanas: Array.from(e.semanas.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([wk, s]) => ({ semana: wk, label: s.label, pedidos: s.pedidos, total: s.total })),
  }));

  return NextResponse.json(result);
}
