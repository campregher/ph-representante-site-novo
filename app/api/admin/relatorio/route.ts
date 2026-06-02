import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function adminDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function orderTotal(o: { total: number; orcamento_itens?: { valor_total: number }[] }) {
  return Number(o.total) || (o.orcamento_itens ?? []).reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value ?? "";
  if (!(await verifyToken(token))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = adminDb();

  const { data: orcamentos, error } = await db
    .from("orcamentos")
    .select("id, status, status_pagamento, marca, total, orcamento_itens(valor_total)")
    .in("status", ["enviado", "aprovado", "finalizado", "recusado", "rascunho"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: marcasDb } = await db
    .from("marcas")
    .select("slug, name")
    .order("name");

  const brandNames: Record<string, string> = Object.fromEntries(
    (marcasDb ?? []).map((m: { slug: string; name: string }) => [m.slug, m.name])
  );

  // Agrupa por marca
  const map = new Map<string, {
    slug: string;
    name: string;
    por_status: Record<string, { count: number; valor: number }>;
    pago: { count: number; valor: number };
    em_aberto: { count: number; valor: number };
    atrasado: { count: number; valor: number };
    total_count: number;
    total_valor: number;
  }>();

  const statuses = ["rascunho", "enviado", "aprovado", "finalizado", "recusado"];

  function getEntry(slug: string) {
    if (!map.has(slug)) {
      map.set(slug, {
        slug,
        name: brandNames[slug] ?? slug,
        por_status: Object.fromEntries(statuses.map((s) => [s, { count: 0, valor: 0 }])),
        pago:      { count: 0, valor: 0 },
        em_aberto: { count: 0, valor: 0 },
        atrasado:  { count: 0, valor: 0 },
        total_count: 0,
        total_valor: 0,
      });
    }
    return map.get(slug)!;
  }

  for (const o of orcamentos ?? []) {
    const slug = o.marca ?? "__sem_marca__";
    const entry = getEntry(slug);
    const valor = orderTotal(o);

    entry.total_count += 1;
    entry.total_valor += valor;

    const st = o.status ?? "rascunho";
    if (entry.por_status[st]) {
      entry.por_status[st].count += 1;
      entry.por_status[st].valor += valor;
    }

    if (st === "aprovado" || st === "finalizado") {
      const sp = o.status_pagamento ?? "em_aberto";
      if (sp === "pago") {
        entry.pago.count += 1;
        entry.pago.valor += valor;
      } else if (sp === "atrasado") {
        entry.atrasado.count += 1;
        entry.atrasado.valor += valor;
      } else {
        entry.em_aberto.count += 1;
        entry.em_aberto.valor += valor;
      }
    }
  }

  const result = Array.from(map.values())
    .filter((e) => e.slug !== "__sem_marca__")
    .sort((a, b) => b.total_valor - a.total_valor);

  // Totais gerais
  const totais = {
    pago:      result.reduce((s, e) => s + e.pago.valor, 0),
    em_aberto: result.reduce((s, e) => s + e.em_aberto.valor, 0),
    atrasado:  result.reduce((s, e) => s + e.atrasado.valor, 0),
    total:     result.reduce((s, e) => s + e.total_valor, 0),
  };

  return NextResponse.json({ marcas: result, totais });
}
