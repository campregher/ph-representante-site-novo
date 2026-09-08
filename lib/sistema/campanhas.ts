import { createSistemaClient } from "@/lib/supabase/server";
import { profileLabelMap } from "@/lib/sistema/queries";
import { daysSince } from "@/lib/sistema/format";
import type { CampanhaModelo, CampanhaAlvo, CampanhaResumo } from "@/lib/sistema/campanhas-types";

export type { CampanhaModelo, CampanhaAlvo, CampanhaResumo } from "@/lib/sistema/campanhas-types";
export { FAIXA_OPCOES } from "@/lib/sistema/campanhas-types";

const CATALOGO_URL = "https://www.phrepresentante.com.br/catalogo";

export async function listModelos(): Promise<CampanhaModelo[]> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("campanha_modelos")
    .select("id, nome, assunto, corpo, ativo")
    .order("created_at", { ascending: true });
  return (data as CampanhaModelo[]) ?? [];
}

export async function getModelo(id: string): Promise<CampanhaModelo | null> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("campanha_modelos")
    .select("id, nome, assunto, corpo, ativo")
    .eq("id", id)
    .maybeSingle();
  return (data as CampanhaModelo) ?? null;
}

/** Clientes-alvo. Respeita RLS (vendedor só vê os seus). */
export async function listAlvos(opts: {
  faixa: string; // "30" | "60" | "90" | "180" | "nunca"
  representadaId?: string;
}): Promise<CampanhaAlvo[]> {
  const supabase = await createSistemaClient();
  const nunca = opts.faixa === "nunca";
  const minDias = nunca ? null : Number(opts.faixa);

  const q = supabase
    .from("clientes")
    .select("id, nome_fantasia, razao_social, email, data_ultima_compra, status, vendedor_id, descadastro_token, aceita_email")
    .neq("status", "bloqueado")
    .eq("aceita_email", true)
    .not("email", "is", null)
    .limit(5000);

  // se filtrar por representada, restringe a clientes vinculados a ela
  let idsRepresentada: Set<string> | null = null;
  if (opts.representadaId) {
    const { data: vinc } = await supabase
      .from("cliente_representada")
      .select("cliente_id")
      .eq("representada_id", opts.representadaId);
    idsRepresentada = new Set((vinc ?? []).map((v) => v.cliente_id as string));
  }

  const { data } = await q;
  const brutos = (data ?? []) as {
    id: string;
    nome_fantasia: string | null;
    razao_social: string | null;
    email: string | null;
    data_ultima_compra: string | null;
    vendedor_id: string | null;
    descadastro_token: string;
  }[];

  const profMap = await profileLabelMap();

  // clientes que já receberam campanha de reativação nos últimos 30 dias
  const recentes = new Set<string>();
  const { data: env } = await supabase
    .from("campanha_envios")
    .select("cliente_id, status, created_at")
    .eq("status", "enviado")
    .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
  for (const e of env ?? []) if (e.cliente_id) recentes.add(e.cliente_id as string);

  const alvos: CampanhaAlvo[] = [];
  for (const c of brutos) {
    if (!c.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) continue;
    if (idsRepresentada && !idsRepresentada.has(c.id)) continue;

    const dias = daysSince(c.data_ultima_compra);
    if (nunca) {
      if (c.data_ultima_compra) continue;
    } else {
      if (dias == null || dias < (minDias as number)) continue;
    }

    alvos.push({
      id: c.id,
      nome: c.nome_fantasia || c.razao_social || "—",
      email: c.email,
      dias,
      vendedor_id: c.vendedor_id,
      vendedorNome: c.vendedor_id ? profMap.get(c.vendedor_id) ?? null : null,
      descadastro_token: c.descadastro_token,
      jaRecebeu30d: recentes.has(c.id),
    });
  }
  alvos.sort((a, b) => (b.dias ?? 1e9) - (a.dias ?? 1e9));
  return alvos;
}

export async function listCampanhas(): Promise<CampanhaResumo[]> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("campanhas")
    .select(
      "id, nome, assunto, faixa_min_dias, inclui_nunca, criado_por, total_alvos, total_enviado, total_erro, total_pulado, enviado_em, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  const profMap = await profileLabelMap();
  return ((data as CampanhaResumo[]) ?? []).map((c) => ({
    ...c,
    criadoNome: c.criado_por ? profMap.get(c.criado_por) ?? null : null,
  }));
}

// ─────────────────────────── Renderização do e-mail ────────────────────────

const BRAND = "#dc2626";

export function preencherVariaveis(
  corpo: string,
  vars: { nome: string; vendedor: string; dias: number | null; empresa: string }
): string {
  return corpo
    .replace(/\{\{\s*nome\s*\}\}/gi, vars.nome)
    .replace(/\{\{\s*vendedor\s*\}\}/gi, vars.vendedor)
    .replace(/\{\{\s*dias\s*\}\}/gi, vars.dias != null ? String(vars.dias) : "muitos")
    .replace(/\{\{\s*empresa\s*\}\}/gi, vars.empresa)
    .replace(/\{\{\s*link_catalogo\s*\}\}/gi, CATALOGO_URL);
}

/** Corpo (texto simples com {{vars}}) → HTML final com cabeçalho, rodapé e descadastro. */
export function renderCampanhaHtml(
  corpo: string,
  vars: { nome: string; vendedor: string; dias: number | null; empresa: string; origem: string; descadastroToken: string }
): string {
  const texto = preencherVariaveis(corpo, vars);
  const paragrafos = texto
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151">${p
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/\n/g, "<br>")
          .replace(
            /(https?:\/\/[^\s<]+)/g,
            '<a href="$1" style="color:' + BRAND + '">$1</a>'
          )}</p>`
    )
    .join("");
  const descadastroUrl = `${vars.origem}/descadastro/${vars.descadastroToken}`;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:28px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.07)">
  <tr><td style="background:#111827;padding:20px 32px">
    <span style="font-size:18px;font-weight:800;color:#fff">${vars.empresa}</span>
  </td></tr>
  <tr><td style="padding:28px 32px 8px">${paragrafos}</td></tr>
  <tr><td style="padding:16px 32px"><a href="https://wa.me/5511959993968" style="display:inline-block;padding:12px 24px;background:${BRAND};color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px">Falar com ${vars.vendedor}</a></td></tr>
  <tr><td style="padding:20px 32px"><hr style="border:none;border-top:1px solid #f0f0f0;margin:0"></td></tr>
  <tr><td style="padding:0 32px 24px;text-align:center">
    <p style="margin:0 0 6px;font-size:12px;color:#9ca3af">${vars.empresa}</p>
    <p style="margin:0;font-size:12px;color:#9ca3af">Não quer mais receber estes e-mails? <a href="${descadastroUrl}" style="color:#9ca3af">Descadastrar</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;
}
