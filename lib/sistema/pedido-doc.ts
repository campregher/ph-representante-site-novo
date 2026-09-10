import { createSistemaClient, createSistemaAdminClient } from "@/lib/supabase/server";
import { getEmpresaConfig, empresaContato } from "@/lib/sistema/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

async function profileNameMap(supabase: AnyClient, ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (!ids.length) return m;
  const { data } = await supabase.from("profiles").select("id, nome, email").in("id", ids);
  for (const p of data ?? []) m.set(p.id as string, (p.nome as string) || (p.email as string) || "—");
  return m;
}
const SELECT =
  "*, cliente:clientes(nome_fantasia, razao_social, cnpj, cpf, inscricao_estadual, logradouro, numero, complemento, bairro, cidade, estado, cep, telefone, whatsapp, email), representada:representadas(nome_fantasia, razao_social, cnpj, logo_url), tabela:tabelas_preco(nome)";
import { PEDIDO_STATUS } from "@/components/sistema/ui/Badge";
import {
  formatBRL,
  formatPercent,
  formatDate,
  formatCpfCnpj,
  formatCNPJ,
  formatPhone,
} from "@/lib/sistema/format";
import type { PedidoPDFData } from "@/components/pdf/PedidoPDF";
import type { Pedido, PedidoItem } from "@/lib/sistema/types";

/** Remove a descrição longa que possa ter sido concatenada em pedidos antigos. */
export function nomeCurto(snap: string | null | undefined): string {
  const s = snap ?? "";
  if (!s.includes("\n")) return s;
  return s.split(/\r?\n/)[0].split(" — ")[0].trim() || s;
}

/** Monta os dados de um pedido para PDF / texto. RLS aplicada. */
export async function getPedidoDoc(id: string): Promise<PedidoPDFData | null> {
  const supabase = await createSistemaClient();
  const { data } = await supabase.from("pedidos").select(SELECT).eq("id", id).maybeSingle();
  return data ? buildPedidoDoc(supabase, data, false) : null;
}

/** Versão pública por token (sem login) — service role, ignora RLS. */
export async function getPedidoDocByToken(token: string): Promise<PedidoPDFData | null> {
  const supabase = await createSistemaAdminClient();
  const { data } = await supabase
    .from("pedidos")
    .select(SELECT)
    .eq("share_token", token)
    .maybeSingle();
  return data ? buildPedidoDoc(supabase, data, true) : null;
}

async function buildPedidoDoc(
  supabase: AnyClient,
  data: unknown,
  publico: boolean
): Promise<PedidoPDFData> {
  const p = data as unknown as Pedido & {
    cliente: {
      nome_fantasia: string | null;
      razao_social: string | null;
      cnpj: string | null;
      cpf: string | null;
      inscricao_estadual: string | null;
      logradouro: string | null;
      numero: string | null;
      complemento: string | null;
      bairro: string | null;
      cidade: string | null;
      estado: string | null;
      cep: string | null;
      telefone: string | null;
      whatsapp: string | null;
      email: string | null;
    } | null;
    representada: {
      nome_fantasia: string | null;
      razao_social: string;
      cnpj: string | null;
      logo_url: string | null;
    } | null;
    tabela: { nome: string } | null;
  };

  const { data: itensRaw } = await supabase
    .from("pedido_itens")
    .select("*")
    .eq("pedido_id", p.id)
    .order("created_at");
  const itens = (itensRaw as PedidoItem[]) ?? [];

  const profileMap = p.vendedor_id
    ? await profileNameMap(supabase, [p.vendedor_id])
    : new Map<string, string>();

  const emp = await getEmpresaConfig(publico);

  const c = p.cliente;
  return {
    numero: p.numero,
    data: formatDate(p.data_pedido),
    statusLabel: PEDIDO_STATUS[p.status]?.label ?? p.status,
    empresa: { nome: emp.empresa_nome, contato: empresaContato(emp), logo: null },
    representada: {
      nome: p.representada
        ? p.representada.nome_fantasia || p.representada.razao_social
        : "—",
      cnpj: p.representada?.cnpj ? formatCNPJ(p.representada.cnpj) : null,
      logo: p.representada?.logo_url ?? null,
    },
    cliente: {
      nome: c ? c.nome_fantasia || c.razao_social || "—" : "—",
      razao: c && c.nome_fantasia && c.razao_social ? c.razao_social : null,
      documento: c ? formatCpfCnpj(c.cnpj || c.cpf) || null : null,
      inscricaoEstadual: c?.inscricao_estadual ?? null,
      endereco: c
        ? [c.logradouro, c.numero, c.complemento].filter(Boolean).join(", ") || null
        : null,
      bairro: c?.bairro ?? null,
      cidadeUf: c ? [c.cidade, c.estado].filter(Boolean).join(" / ") || null : null,
      cep: c?.cep ?? null,
      telefone: c ? (c.telefone || c.whatsapp ? formatPhone(c.telefone || c.whatsapp || "") : null) : null,
      email: c?.email ?? null,
    },
    tabela: p.tabela?.nome ?? null,
    vendedor: p.vendedor_id ? profileMap.get(p.vendedor_id) ?? null : null,
    condicao_pagamento: p.condicao_pagamento,
    forma_pagamento: p.forma_pagamento,
    previsao_entrega: p.previsao_entrega ? formatDate(p.previsao_entrega) : null,
    itens: itens.map((it) => ({
      sku: it.sku_snapshot ?? "",
      descricao: nomeCurto(it.descricao_snapshot),
      qtd: Number(it.quantidade),
      preco: Number(it.preco_tabela),
      descPct: Number(it.desconto_item_percentual),
      cascata: Array.isArray(it.desconto_cascata)
        ? it.desconto_cascata.map(Number).filter((n) => n > 0)
        : [],
      acrescimo: Array.isArray(it.acrescimo_cascata)
        ? it.acrescimo_cascata.map(Number).filter((n) => n > 0)
        : [],
      precoManual: it.preco_liquido_manual != null,
      precoFinal:
        Number(it.preco_unitario_final) ||
        Number(it.preco_tabela) * (1 - (Number(it.desconto_item_percentual) || 0) / 100),
      total: Number(it.valor_total),
    })),
    subtotal: Number(p.subtotal),
    descontoPct: Number(p.desconto_percentual),
    descontoValor: Number(p.desconto_valor),
    descontoCascata: Array.isArray(p.desconto_cascata)
      ? p.desconto_cascata.map(Number).filter((n) => n > 0)
      : [],
    total: Number(p.valor_total),
    observacaoCliente: p.observacao_cliente,
  };
}

/** "50+6,66+4" a partir de [50, 6.66, 4] */
export function cascataLabel(cascata: number[] | null | undefined): string {
  return (cascata ?? []).map((c) => String(c).replace(".", ",")).join("+");
}

/** Versão texto (para "Copiar pedido"). */
export function pedidoDocToText(d: PedidoPDFData): string {
  const L: string[] = [];
  L.push(`*PEDIDO #${d.numero}* — ${d.empresa.nome}`);
  L.push(`Representada: ${d.representada.nome}`);
  L.push(`Data: ${d.data}  |  Status: ${d.statusLabel}`);
  L.push("");
  L.push(`*Cliente:* ${d.cliente.nome}`);
  if (d.cliente.documento) L.push(`Doc: ${d.cliente.documento}`);
  if (d.cliente.endereco) L.push(`${d.cliente.endereco}${d.cliente.cidadeUf ? ` — ${d.cliente.cidadeUf}` : ""}`);
  if (d.cliente.telefone) L.push(`Tel: ${d.cliente.telefone}`);
  L.push("");
  if (d.tabela) L.push(`Tabela: ${d.tabela}`);
  if (d.condicao_pagamento) L.push(`Pagamento: ${d.condicao_pagamento}`);
  if (d.previsao_entrega) L.push(`Previsão de entrega: ${d.previsao_entrega}`);
  L.push("");
  L.push("*Itens:*");
  for (const it of d.itens) {
    const passos = [
      ...(it.cascata ?? []).map((c) => `-${String(c).replace(".", ",")}%`),
      ...(it.acrescimo ?? []).map((c) => `+${String(c).replace(".", ",")}%`),
    ].join(" ");
    const descTxt = passos
      ? ` (${passos} = ${formatPercent(it.descPct)} = ${formatBRL(it.precoFinal)}/un)`
      : it.descPct !== 0
        ? ` (${it.descPct > 0 ? "-" : "+"}${formatPercent(Math.abs(it.descPct))} = ${formatBRL(it.precoFinal)}/un)`
        : "";
    L.push(
      `• ${it.sku} — ${it.descricao} | ${it.qtd} x ${formatBRL(it.preco)}${descTxt} = ${formatBRL(it.total)}`
    );
  }
  L.push("");
  L.push(`Subtotal: ${formatBRL(d.subtotal)}`);
  L.push(
    `Desconto adicional (${
      d.descontoCascata && d.descontoCascata.length > 1
        ? `${cascataLabel(d.descontoCascata)} = `
        : ""
    }${formatPercent(d.descontoPct)}): -${formatBRL(d.descontoValor)}`
  );
  L.push(`*TOTAL: ${formatBRL(d.total)}*`);
  if (d.observacaoCliente) {
    L.push("");
    L.push(`Obs.: ${d.observacaoCliente}`);
  }
  return L.join("\n");
}
