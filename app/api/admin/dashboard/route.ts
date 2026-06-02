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

function orderTotal(o: { total: number; orcamento_itens: { valor_total: number }[] }) {
  return Number(o.total) || (o.orcamento_itens ?? []).reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value ?? "";
  if (!(await verifyToken(token))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = adminDb();

  const [{ data: orcamentos }, { count: totalClientes }] = await Promise.all([
    db.from("orcamentos").select("id, status, status_pagamento, marca, total, created_at, orcamento_itens(produto_sku, produto_nome, quantidade, valor_total)"),
    db.from("clientes").select("id", { count: "exact", head: true }).eq("status", "aprovado"),
  ]);

  const all = orcamentos ?? [];
  const aprovados = all.filter((o) => o.status === "aprovado");

  const totalVendido = aprovados.reduce((s, o) => s + orderTotal(o), 0);

  const aReceber = aprovados
    .filter((o) => (o.status_pagamento ?? "em_aberto") !== "pago")
    .reduce((s, o) => s + orderTotal(o), 0);

  const atrasado = aprovados
    .filter((o) => o.status_pagamento === "atrasado")
    .reduce((s, o) => s + orderTotal(o), 0);

  const pendentes = all.filter((o) => o.status === "enviado").length;

  // Sales by brand
  const brandMap: Record<string, { total: number; pedidos: number }> = {};
  for (const o of aprovados) {
    const key = o.marca ?? "Sem marca";
    if (!brandMap[key]) brandMap[key] = { total: 0, pedidos: 0 };
    brandMap[key].total += orderTotal(o);
    brandMap[key].pedidos += 1;
  }
  const porMarca = Object.entries(brandMap)
    .map(([marca, d]) => ({ marca, ...d }))
    .sort((a, b) => b.total - a.total);

  // Top products by quantity
  const prodMap: Record<string, { nome: string; quantidade: number; total: number }> = {};
  for (const o of aprovados) {
    for (const item of o.orcamento_itens ?? []) {
      const key = item.produto_sku as string;
      if (!prodMap[key]) prodMap[key] = { nome: item.produto_nome as string, quantidade: 0, total: 0 };
      prodMap[key].quantidade += Number(item.quantidade ?? 0);
      prodMap[key].total += Number(item.valor_total ?? 0);
    }
  }
  const topProdutos = Object.entries(prodMap)
    .map(([sku, d]) => ({ sku, ...d }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);

  return NextResponse.json({
    totalVendido,
    aReceber,
    atrasado,
    totalClientes: totalClientes ?? 0,
    pendentes,
    pedidosAprovados: aprovados.length,
    porMarca,
    topProdutos,
  });
}
