/** CNAEs aceitos pro cadastro de seller — exigência dos fornecedores de
 *  dropshipping, que só revendem pra quem comercializa peças/acessórios
 *  automotivos de verdade (4530-7/01 atacado, 4530-7/03 varejo). */
export const CNAES_SELLER_PERMITIDOS: Record<string, string> = {
  "4530701": "Comércio por atacado de peças e acessórios novos para veículos automotores",
  "4530703": "Comércio a varejo de peças e acessórios novos para veículos automotores",
};

export function formatarCnae(codigo: string): string {
  const d = codigo.replace(/\D/g, "");
  if (d.length !== 7) return codigo;
  return `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5, 7)}`;
}

export function cnaeSellerPermitido(cnaePrincipal: string, cnaesSecundarios: string[] = []): boolean {
  const todos = [cnaePrincipal, ...cnaesSecundarios].filter(Boolean);
  return todos.some((c) => c in CNAES_SELLER_PERMITIDOS);
}
