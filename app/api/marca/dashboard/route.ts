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
    .select("id, numero, status, total, created_at, orcamento_itens(valor_total), clientes(razao_social)")
    .eq("marca", ctx.marcaSlug)
    .order("created_at", { ascending: false });

  const all = orders ?? [];

  // Contadores operacionais (status machine: enviado → em_separacao → a_pagar → pago | recusado)
  const cutoff24h    = Date.now() - 24 * 60 * 60 * 1000;
  const aguardando   = all.filter((o) => o.status === "enviado").length;
  const atrasados    = all.filter((o) => o.status === "enviado" && new Date(o.created_at).getTime() < cutoff24h).length;
  const emSeparacao  = all.filter((o) => o.status === "em_separacao").length;
  const emEnvio      = all.filter((o) => o.status === "a_pagar").length;
  const totalPedidos = all.length;

  // Financeiro
  const totalFaturado = all
    .filter((o) => o.status === "pago")
    .reduce((s, o) => s + orderTotal(o), 0);

  const aReceber = all
    .filter((o) => o.status === "a_pagar")
    .reduce((s, o) => s + orderTotal(o), 0);

  // Pedidos recentes (últimos 10)
  const recent = all.slice(0, 10).map((o) => ({
    id:         o.id,
    numero:     o.numero,
    status:     o.status,
    total:      orderTotal(o),
    created_at: o.created_at,
    cliente:    (o.clientes as unknown as { razao_social: string } | null)?.razao_social ?? "—",
  }));

  return NextResponse.json({
    aguardando,
    atrasados,
    emSeparacao,
    emEnvio,
    totalPedidos,
    totalFaturado,
    aReceber,
    recent,
  });
}
