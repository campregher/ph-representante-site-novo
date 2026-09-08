import { createSistemaClient, createSistemaAdminClient } from "@/lib/supabase/server";
import { COMPANY_NAME, WHATSAPP_NUMBER, EMAIL, COMPANY_CITY } from "@/lib/constants";
import { formatPhone } from "@/lib/sistema/format";

export interface EmpresaConfig {
  empresa_nome: string;
  whatsapp: string | null;
  email: string | null;
  cnpj: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  site: string | null;
  observacoes_padrao_pedido: string | null;
}

const FALLBACK: EmpresaConfig = {
  empresa_nome: COMPANY_NAME,
  whatsapp: WHATSAPP_NUMBER,
  email: EMAIL,
  cnpj: null,
  telefone: null,
  endereco: null,
  cidade: COMPANY_CITY,
  site: "phrepresentante.com.br",
  observacoes_padrao_pedido: null,
};

/** Config da empresa (linha única). Usa admin client p/ funcionar em contexto público. */
export async function getEmpresaConfig(publico = false): Promise<EmpresaConfig> {
  try {
    const supabase = publico ? await createSistemaAdminClient() : await createSistemaClient();
    const { data } = await supabase.from("config").select("*").eq("id", "default").maybeSingle();
    if (!data) return FALLBACK;
    return {
      empresa_nome: (data.empresa_nome as string) || FALLBACK.empresa_nome,
      whatsapp: (data.whatsapp as string) ?? FALLBACK.whatsapp,
      email: (data.email as string) ?? FALLBACK.email,
      cnpj: (data.cnpj as string) ?? null,
      telefone: (data.telefone as string) ?? null,
      endereco: (data.endereco as string) ?? null,
      cidade: (data.cidade as string) ?? FALLBACK.cidade,
      site: (data.site as string) ?? FALLBACK.site,
      observacoes_padrao_pedido: (data.observacoes_padrao_pedido as string) ?? null,
    };
  } catch {
    return FALLBACK;
  }
}

/** Linha de contato para cabeçalho de documentos. */
export function empresaContato(c: EmpresaConfig): string {
  const parts: string[] = [];
  if (c.email) parts.push(c.email);
  const wpp = c.whatsapp?.replace(/\D/g, "");
  if (wpp) parts.push(`WhatsApp ${formatPhone(wpp.length > 11 ? wpp.slice(2) : wpp)}`);
  else if (c.telefone) parts.push(formatPhone(c.telefone));
  return parts.join(" · ");
}
