/** Preço bruto efetivo: o da variação quando informado, senão o do produto pai. */
export function brutoEfetivo(
  variacaoBruto: number | null | undefined,
  produtoBruto: number | null | undefined
): number | null {
  if (variacaoBruto != null && Number.isFinite(variacaoBruto)) return Number(variacaoBruto);
  if (produtoBruto != null && Number.isFinite(produtoBruto)) return Number(produtoBruto);
  return null;
}

/** Preço líquido de um produto numa tabela.
 *  override tem prioridade; senão bruto − desconto% da tabela. */
export function precoLiquido(
  bruto: number | null | undefined,
  descontoPercentual: number | null | undefined,
  override?: number | null
): number | null {
  if (override != null && Number.isFinite(override)) return override;
  if (bruto == null || !Number.isFinite(bruto)) return null;
  const d = Math.min(Math.max(Number(descontoPercentual) || 0, 0), 100);
  return Math.round(bruto * (1 - d / 100) * 100) / 100;
}

/** Margem mínima efetiva do produto no drop: override do produto tem
 *  prioridade sobre a margem definida na categoria. */
export function margemMinimaEfetiva(
  produtoMargem: number | null | undefined,
  categoriaMargem: number | null | undefined
): number | null {
  if (produtoMargem != null && Number.isFinite(produtoMargem)) return Number(produtoMargem);
  if (categoriaMargem != null && Number.isFinite(categoriaMargem)) return Number(categoriaMargem);
  return null;
}

/** Preço mínimo de revenda do seller dado o custo e a margem mínima % (sobre
 *  o preço de venda, mesma convenção de `margemPct` do relatório de estoque:
 *  margem% = (preço − custo) / preço × 100 ⇒ preço = custo / (1 − margem%/100).
 *  Sem custo ou sem margem definida, não dá pra calcular (retorna null). */
export function precoMinimoVenda(
  custo: number | null | undefined,
  margemMinimaPercentual: number | null | undefined
): number | null {
  if (custo == null || !Number.isFinite(custo)) return null;
  if (margemMinimaPercentual == null || !Number.isFinite(margemMinimaPercentual)) return null;
  const m = Math.min(Math.max(Number(margemMinimaPercentual), 0), 99);
  return Math.round((custo / (1 - m / 100)) * 100) / 100;
}
