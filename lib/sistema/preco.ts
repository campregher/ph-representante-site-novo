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
