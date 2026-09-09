// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

/**
 * Aplica um movimento de estoque a um produto da linha própria:
 * lê o saldo atual, grava a linha em estoque_movimentos e atualiza
 * produtos.estoque_atual. Retorna o novo saldo.
 */
export async function aplicarMovimento(
  supabase: Client,
  m: {
    produtoId: string;
    delta: number; // + entrada, - saída
    tipo: "entrada" | "saida" | "ajuste";
    origemTipo?: string;
    origemId?: string;
    observacao?: string;
    userId?: string | null;
  }
): Promise<number> {
  const { data: prod } = await supabase
    .from("produtos")
    .select("estoque_atual")
    .eq("id", m.produtoId)
    .maybeSingle();
  const saldoAntes = Number(prod?.estoque_atual ?? 0);
  const saldoApos = saldoAntes + m.delta;

  await supabase.from("estoque_movimentos").insert({
    produto_id: m.produtoId,
    tipo: m.tipo,
    quantidade: m.delta,
    saldo_apos: saldoApos,
    origem_tipo: m.origemTipo ?? null,
    origem_id: m.origemId ?? null,
    observacao: m.observacao ?? null,
    created_by: m.userId ?? null,
  });
  await supabase.from("produtos").update({ estoque_atual: saldoApos }).eq("id", m.produtoId);
  return saldoApos;
}

/** Custo médio ponderado após uma entrada de compra. */
export function custoMedio(
  custoAtual: number | null,
  saldoAtual: number,
  custoEntrada: number,
  qtdEntrada: number
): number {
  const ca = Number(custoAtual ?? 0);
  const base = ca * Math.max(saldoAtual, 0) + custoEntrada * qtdEntrada;
  const tot = Math.max(saldoAtual, 0) + qtdEntrada;
  if (tot <= 0) return custoEntrada;
  return Math.round((base / tot) * 100) / 100;
}
