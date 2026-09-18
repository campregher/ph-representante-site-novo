import { buscarCnpj } from "@/lib/sistema/cnpj";

/** Valida o dígito verificador do CPF (algoritmo padrão). Não confirma
 *  situação na Receita — só que o número é matematicamente válido. */
export function cpfValido(cpfLimpo: string): boolean {
  const cpf = cpfLimpo.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digitos = cpf.split("").map(Number);
  const calcula = (fatorInicial: number) => {
    let soma = 0;
    for (let i = 0; i < fatorInicial - 1; i++) soma += digitos[i] * (fatorInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calcula(10) === digitos[9] && calcula(11) === digitos[10];
}

export interface ValidacaoDocumento {
  aprovado: boolean;
  motivo: string;
}

/** Decide se o cadastro do seller pode ser auto-aprovado a partir do documento. */
export async function validarDocumentoSeller(cliente: {
  cnpj: string | null;
  cpf: string | null;
}): Promise<ValidacaoDocumento> {
  if (cliente.cnpj) {
    const r = await buscarCnpj(cliente.cnpj);
    if ("error" in r) {
      return { aprovado: false, motivo: `Não foi possível consultar o CNPJ na Receita (${r.error}).` };
    }
    const situacao = (r.data.situacao || "").toUpperCase();
    const ativa = situacao.includes("ATIVA");
    return {
      aprovado: ativa,
      motivo: ativa
        ? "CNPJ ativo na Receita Federal."
        : `CNPJ com situação "${r.data.situacao || "desconhecida"}" — não está ativo.`,
    };
  }
  if (cliente.cpf) {
    const ok = cpfValido(cliente.cpf);
    return {
      aprovado: ok,
      motivo: ok
        ? "CPF com dígito verificador válido (não confirma situação na Receita)."
        : "CPF inválido — dígito verificador não confere.",
    };
  }
  return { aprovado: false, motivo: "Cadastro sem CNPJ ou CPF." };
}
