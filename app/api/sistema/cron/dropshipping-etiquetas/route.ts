import { NextResponse } from "next/server";
import { createDropshippingAdminClient } from "@/lib/supabase/server";
import { processarPedidoAguardandoNF } from "@/lib/sistema/dropshipping-pedido-arquivos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PEDIDOS_COLS =
  "id, numero, ml_conta_id, ml_shipping_id, pedido_externo, ultima_checagem_em, entrega_nome, entrega_telefone, entrega_cep, entrega_logradouro, entrega_numero, entrega_bairro, entrega_cidade, entrega_uf, pedido_itens(quantidade, sku_snapshot, descricao_snapshot)";

/**
 * Cron diário (ver vercel.json — Vercel Hobby só libera 1x/dia) — rede de
 * segurança pros pedidos de dropshipping aguardando o seller declarar a NF
 * do consumidor final no Mercado Livre. A checagem rápida de verdade
 * acontece quando o próprio seller abre `/drop/dashboard/pedidos` (ver
 * `lib/sistema/seller-pedidos.ts`); esse cron só garante que nenhum pedido
 * fique parado indefinidamente se o seller não voltar na página.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const db = await createDropshippingAdminClient();
  const { data: pedidos, error } = await db
    .from("pedidos")
    .select(PEDIDOS_COLS)
    .eq("status", "aguardando_nf")
    .limit(100);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let prontos = 0;
  const erros: string[] = [];
  for (const p of pedidos ?? []) {
    try {
      const res = await processarPedidoAguardandoNF(db, p as never);
      if (res.ficouPronto) prontos++;
    } catch (e) {
      erros.push(`pedido ${p.numero}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, processados: pedidos?.length ?? 0, prontos, erros });
}
