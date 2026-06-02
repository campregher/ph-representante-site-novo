import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: clienteRow } = await supabase
    .from("clientes")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!clienteRow) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const { data: orcamentos } = await supabase
    .from("orcamentos")
    .select("id, status, marca, total, orcamento_itens(produto_sku, produto_nome, quantidade, valor_total)")
    .eq("cliente_id", clienteRow.id);

  const all = orcamentos ?? [];

  function orderTotal(o: { total: number; orcamento_itens: { valor_total: number }[] }) {
    return Number(o.total) || (o.orcamento_itens ?? []).reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
  }

  // Contadores operacionais
  const emAprovacao  = all.filter((o) => o.status === "enviado").length;
  const aprovados    = all.filter((o) => o.status === "em_separacao").length;
  const emEnvio      = all.filter((o) => o.status === "a_pagar").length;
  const totalPedidos = all.length;

  // Financeiro
  const totalGasto = all
    .filter((o) => o.status === "pago")
    .reduce((s, o) => s + orderTotal(o), 0);

  const aPagar = all
    .filter((o) => o.status === "a_pagar")
    .reduce((s, o) => s + orderTotal(o), 0);

  // Compras por marca (pedidos pagos + a_pagar)
  const brandMap: Record<string, { total: number; pedidos: number }> = {};
  for (const o of all.filter((o) => o.status === "pago" || o.status === "a_pagar" || o.status === "em_separacao")) {
    const key = o.marca ?? "Sem marca";
    if (!brandMap[key]) brandMap[key] = { total: 0, pedidos: 0 };
    brandMap[key].total += orderTotal(o);
    brandMap[key].pedidos += 1;
  }
  const porMarca = Object.entries(brandMap)
    .map(([marca, d]) => ({ marca, ...d }))
    .sort((a, b) => b.total - a.total);

  // Top produtos (de todos os pedidos ativos)
  const prodMap: Record<string, { nome: string; quantidade: number; total: number }> = {};
  for (const o of all.filter((o) => o.status !== "recusado" && o.status !== "rascunho")) {
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
    emAprovacao,
    aprovados,
    emEnvio,
    totalPedidos,
    totalGasto,
    aPagar,
    porMarca,
    topProdutos,
  });
}
