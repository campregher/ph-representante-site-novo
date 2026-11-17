import { NextResponse } from "next/server";
import { createDropshippingAdminClient } from "@/lib/supabase/server";
import { atualizarEnvioEDevolucaoPedido } from "@/lib/sistema/dropshipping-pedido-envio-status";
import { processarEnvioAutomaticoPorFornecedor } from "@/lib/sistema/dropshipping-pedido-envio-automatico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PEDIDOS_COLS = "id, canal, ml_conta_id, ml_shipping_id, pedido_externo, ml_envio_atualizado_em";

/**
 * Cron diário (ver vercel.json — Vercel Hobby só libera 1x/dia) — rede de
 * segurança pro status real de envio/devolução dos pedidos de dropshipping
 * (ver dropshipping-pedido-envio-status.ts). A checagem rápida de verdade
 * acontece via webhook (topics "shipments"/"post_purchase") e quando o
 * seller/admin abrem a página de Pedidos; esse cron só garante que nenhum
 * pedido fique sem atualizar se o webhook falhar ou não estiver habilitado
 * no painel de desenvolvedores do ML.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const db = await createDropshippingAdminClient();
  // pedidos "enviado" (repasse) também entram — o ML pode continuar
  // atualizando o envio físico/devolução bem depois do repasse pro
  // fornecedor. "cancelado" fica de fora (não há mais o que acompanhar).
  const { data: pedidos, error } = await db
    .from("pedidos")
    .select(PEDIDOS_COLS)
    .in("status", ["aguardando_nf", "pronto", "enviado"])
    .limit(200);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let atualizados = 0;
  const erros: string[] = [];
  for (const p of pedidos ?? []) {
    try {
      await atualizarEnvioEDevolucaoPedido(db, p as never);
      atualizados++;
    } catch (e) {
      erros.push(`pedido ${p.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Rede de segurança do envio automático pro fornecedor (ver
  // dropshipping-pedido-envio-automatico.ts): a checagem rápida de verdade
  // acontece quando o seller abre "Pedidos" — esse cron só garante que um
  // fornecedor com lote pendente não fique esquecido se o seller não voltar
  // ao app por um tempo.
  const { data: prontos } = await db
    .from("pedidos")
    .select("cliente_id, pedido_itens(produto:produtos(fornecedor_id))")
    .eq("status", "pronto")
    .limit(500);
  const fornecedorIdsPorCliente = new Map<string, Set<string>>();
  for (const p of prontos ?? []) {
    const clienteId = p.cliente_id as string;
    const itens = p.pedido_itens as unknown as { produto: { fornecedor_id: string | null }[] }[];
    const fornecedorIds = itens.flatMap((it) => it.produto.map((pr) => pr.fornecedor_id)).filter((v): v is string => !!v);
    if (fornecedorIds.length === 0) continue;
    const set = fornecedorIdsPorCliente.get(clienteId) ?? new Set<string>();
    for (const id of fornecedorIds) set.add(id);
    fornecedorIdsPorCliente.set(clienteId, set);
  }
  for (const [clienteId, fornecedorIds] of fornecedorIdsPorCliente) {
    try {
      await processarEnvioAutomaticoPorFornecedor(clienteId, [...fornecedorIds]);
    } catch (e) {
      erros.push(`envio automático cliente ${clienteId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, processados: pedidos?.length ?? 0, atualizados, erros });
}
