export interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

/** Consulta ViaCEP (grátis, sem chave). */
export async function buscarCep(
  cepLimpo: string
): Promise<{ data: CepData } | { error: string; status: number }> {
  if (cepLimpo.length !== 8) return { error: "CEP inválido.", status: 400 };

  try {
    const r = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, { cache: "no-store" });
    if (!r.ok) return { error: "Não foi possível consultar o CEP agora. Tente novamente.", status: 502 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await r.json();
    if (d.erro) return { error: "CEP não encontrado.", status: 404 };
    return {
      data: {
        cep: String(d.cep ?? "").replace(/\D/g, ""),
        logradouro: d.logradouro ?? "",
        complemento: d.complemento ?? "",
        bairro: d.bairro ?? "",
        cidade: d.localidade ?? "",
        estado: d.uf ?? "",
      },
    };
  } catch {
    return { error: "Não foi possível consultar o CEP agora. Tente novamente.", status: 502 };
  }
}
