import { createSistemaAdminClient } from "@/lib/supabase/server";
import { STATUS_VENDA } from "@/lib/sistema/types";

const VENDA = [...STATUS_VENDA] as string[];

/**
 * Mantém 1 linha em `comercial.comissoes` por pedido, derivada do pedido.
 * Usa o admin client (service role) porque a RLS de comissoes só deixa
 * admin/financeiro escreverem — a geração é automática a partir do pedido.
 *
 * - pedido em status de venda (confirmado..pendencia) → cria/atualiza os
 *   campos de cálculo (base, %, valor, competência). Preserva status de
 *   recebimento, data_recebimento e observações já lançados pelo financeiro.
 * - pedido fora de venda (orçamento/cancelado/rejeitado) → remove a linha
 *   apenas se ainda estiver `a_receber` (nunca apaga comissão já recebida).
 */
export async function sincronizarComissaoPedido(pedidoId: string): Promise<void> {
  const db = await createSistemaAdminClient();

  const { data: ped } = await db
    .from("pedidos")
    .select("id, representada_id, vendedor_id, status, valor_total, data_pedido")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!ped) return;

  const { data: existente } = await db
    .from("comissoes")
    .select("id, status")
    .eq("pedido_id", pedidoId)
    .maybeSingle();

  const ehVenda = VENDA.includes(ped.status as string);

  if (!ehVenda) {
    if (existente && (existente as { status: string }).status === "a_receber") {
      await db.from("comissoes").delete().eq("id", (existente as { id: string }).id);
    }
    return;
  }

  let percentual = 0;
  if (ped.representada_id) {
    const { data: rep } = await db
      .from("representadas")
      .select("percentual_comissao_padrao")
      .eq("id", ped.representada_id as string)
      .maybeSingle();
    percentual = Number(rep?.percentual_comissao_padrao ?? 0);
  }

  const valorBase = Number(ped.valor_total ?? 0);
  const valorComissao = Math.round(valorBase * percentual) / 100;
  const competencia = String(ped.data_pedido ?? "").slice(0, 7); // YYYY-MM

  const calc = {
    representada_id: ped.representada_id,
    vendedor_id: ped.vendedor_id,
    valor_base: valorBase,
    percentual,
    valor_comissao: valorComissao,
    competencia,
  };

  if (existente) {
    await db.from("comissoes").update(calc).eq("id", (existente as { id: string }).id);
  } else {
    await db.from("comissoes").insert({ pedido_id: pedidoId, status: "a_receber", ...calc });
  }
}
