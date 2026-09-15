export interface CnpjData {
  fonte: "cnpja" | "brasilapi";
  razao_social: string;
  nome_fantasia: string;
  inscricao_estadual: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  telefone: string;
  email: string;
  situacao: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Consulta CNPJá (com fallback BrasilAPI). Usado pela rota interna e pela pública (/drop). */
export async function buscarCnpj(
  cnpjLimpo: string
): Promise<{ data: CnpjData } | { error: string; status: number }> {
  if (cnpjLimpo.length !== 14) return { error: "CNPJ inválido.", status: 400 };

  // 1) CNPJá aberto — inclui inscrição estadual (registrations)
  try {
    const r = await fetch(`https://open.cnpja.com/office/${cnpjLimpo}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (r.ok) {
      const d: any = await r.json();
      const regs: any[] = Array.isArray(d.registrations) ? d.registrations : [];
      const reg = regs.find((x) => x.enabled) ?? regs[0] ?? null;
      const ph = Array.isArray(d.phones) && d.phones[0] ? d.phones[0] : null;
      const data: CnpjData = {
        fonte: "cnpja",
        razao_social: d.company?.name ?? "",
        nome_fantasia: d.alias ?? "",
        inscricao_estadual: reg?.number ?? "",
        cep: String(d.address?.zip ?? "").replace(/\D/g, ""),
        logradouro: d.address?.street ?? "",
        numero: String(d.address?.number ?? ""),
        complemento: d.address?.details ?? "",
        bairro: d.address?.district ?? "",
        cidade: d.address?.city ?? "",
        estado: d.address?.state ?? "",
        telefone: ph ? `(${ph.area}) ${ph.number}` : "",
        email: Array.isArray(d.emails) && d.emails[0] ? d.emails[0].address : "",
        situacao: d.status?.text ?? "",
      };
      return { data };
    }
    if (r.status === 404) return { error: "CNPJ não encontrado na Receita.", status: 404 };
  } catch {
    /* cai no fallback */
  }

  // 2) Fallback BrasilAPI (sem inscrição estadual)
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (r.ok) {
      const d: any = await r.json();
      const tel = d.ddd_telefone_1 ? String(d.ddd_telefone_1) : "";
      const data: CnpjData = {
        fonte: "brasilapi",
        razao_social: d.razao_social ?? "",
        nome_fantasia: d.nome_fantasia ?? "",
        inscricao_estadual: "",
        cep: String(d.cep ?? "").replace(/\D/g, ""),
        logradouro: [d.descricao_tipo_logradouro, d.logradouro].filter(Boolean).join(" "),
        numero: String(d.numero ?? ""),
        complemento: d.complemento ?? "",
        bairro: d.bairro ?? "",
        cidade: d.municipio ?? "",
        estado: d.uf ?? "",
        telefone: tel ? `(${tel.slice(0, 2)}) ${tel.slice(2)}` : "",
        email: d.email ?? "",
        situacao: d.descricao_situacao_cadastral ?? "",
      };
      return { data };
    }
    if (r.status === 404) return { error: "CNPJ não encontrado na Receita.", status: 404 };
    if (r.status === 429)
      return { error: "Muitas consultas seguidas. Aguarde alguns segundos.", status: 429 };
  } catch {
    /* ignora */
  }

  return { error: "Não foi possível consultar o CNPJ agora. Tente novamente.", status: 502 };
}
