import { createSistemaClient } from "@/lib/supabase/server";
import { representadaLabelMap } from "@/lib/sistema/queries";
import { STATUS_VENDA } from "@/lib/sistema/types";
import { daysSince } from "@/lib/sistema/format";

const VENDA = [...STATUS_VENDA] as string[];

export interface DashCard {
  label: string;
  value: string;
  hint?: string;
}
export interface DashBar {
  label: string;
  value: number;
  href?: string;
  hint?: string;
}
export interface DashList {
  count: number;
  itens: { id: string; nome: string; dias: number | null }[];
}

export interface DashboardData {
  cards: DashCard[];
  evolucao: { label: string; value: number }[];
  evolucaoMeta: (number | null)[];
  metaValor: number | null;
  vendasRepresentada: DashBar[];
  abcClientes: DashBar[];
  abcProdutos: DashBar[];
  inativos: DashList;
  aRisco: DashList;
}

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

/** "YYYY-MM" a partir de um Date ou de uma string ISO/date (sem cair em fuso). */
function ym(d: Date | string): string {
  if (typeof d === "string") {
    const m = d.match(/^(\d{4})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
    d = new Date(d);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function classificaABC<T extends { value: number }>(rows: T[]): (T & { classe: "A" | "B" | "C" })[] {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  let acc = 0;
  return rows.map((r) => {
    acc += r.value;
    const p = acc / total;
    return { ...r, classe: p <= 0.8 ? "A" : p <= 0.95 ? "B" : ("C" as const) };
  });
}

export async function getDashboard(opts: {
  mes: string; // YYYY-MM
  representadaId?: string;
  vendedorId?: string;
}): Promise<DashboardData> {
  const supabase = await createSistemaClient();
  const [ano, mesN] = opts.mes.split("-").map(Number);
  const fimMes = new Date(ano, mesN, 1);
  const inicio12 = new Date(ano, mesN - 1 - 11, 1);

  let pedidosQuery = supabase
    .from("pedidos")
    .select("id, cliente_id, representada_id, vendedor_id, status, valor_total, data_pedido")
    .gte("data_pedido", inicio12.toISOString())
    .lt("data_pedido", fimMes.toISOString());
  if (opts.representadaId) pedidosQuery = pedidosQuery.eq("representada_id", opts.representadaId);
  if (opts.vendedorId) pedidosQuery = pedidosQuery.eq("vendedor_id", opts.vendedorId);

  let clientesQuery = supabase
    .from("clientes")
    .select("id, nome_fantasia, razao_social, data_ultima_compra, status");
  if (opts.vendedorId) clientesQuery = clientesQuery.eq("vendedor_id", opts.vendedorId);

  const [
    { data: pedidos12 },
    repMap,
    { data: clientesRaw },
    { data: metasRaw },
    { data: representadasPct },
  ] = await Promise.all([
    pedidosQuery,
    representadaLabelMap(),
    clientesQuery,
    supabase.from("metas_vendas").select("ano, mes, vendedor_id, representada_id, valor_meta"),
    supabase.from("representadas").select("id, percentual_comissao_padrao"),
  ]);

  const peds = (pedidos12 as unknown as
    | {
        id: string;
        cliente_id: string;
        representada_id: string;
        vendedor_id: string | null;
        status: string;
        valor_total: number;
        data_pedido: string;
      }[]
    | null) ?? [];

  const clientes = clientesRaw ?? [];
  const clienteNome = new Map(
    clientes.map((c) => [
      c.id as string,
      (c.nome_fantasia as string) || (c.razao_social as string) || "—",
    ])
  );

  const pctComissao = new Map(
    (representadasPct ?? []).map((r) => [
      r.id as string,
      Number(r.percentual_comissao_padrao ?? 0),
    ])
  );

  // ── mês selecionado ──
  const alvo = opts.mes; // YYYY-MM
  const doMes = peds.filter((p) => ym(p.data_pedido) === alvo);
  const vendasMes = doMes.filter((p) => VENDA.includes(p.status));
  const vendasTotal = vendasMes.reduce((s, p) => s + Number(p.valor_total), 0);
  const qtdVendas = vendasMes.length;
  const pedidosMes = doMes.filter((p) => !["cancelado", "rejeitado"].includes(p.status)).length;
  const clientesCompradores = new Set(vendasMes.map((p) => p.cliente_id)).size;
  const ticket = qtdVendas ? vendasTotal / qtdVendas : 0;
  const aguardando = doMes.filter((p) => p.status === "confirmado").length;
  const comissaoPrevista = vendasMes.reduce(
    (s, p) => s + Number(p.valor_total) * (pctComissao.get(p.representada_id) ?? 0) / 100,
    0
  );

  // meta do mês (geral, ou do vendedor/representada filtrado)
  const meta =
    (metasRaw ?? []).find(
      (m) =>
        Number(m.ano) === ano &&
        Number(m.mes) === mesN &&
        (opts.vendedorId ? m.vendedor_id === opts.vendedorId : !m.vendedor_id) &&
        (opts.representadaId ? m.representada_id === opts.representadaId : !m.representada_id)
    ) ?? null;
  const metaValor = meta ? Number(meta.valor_meta) : null;
  const pctMeta = metaValor ? (vendasTotal / metaValor) * 100 : null;

  const cards: DashCard[] = [
    { label: "Vendas no mês", value: money(vendasTotal) },
    { label: "Pedidos no mês", value: String(pedidosMes) },
    { label: "Clientes compradores", value: String(clientesCompradores) },
    { label: "Ticket médio", value: money(ticket) },
    { label: "Comissão prevista", value: money(comissaoPrevista) },
    {
      label: "Meta mensal",
      value: metaValor != null ? money(metaValor) : "—",
      hint: metaValor == null ? "defina em Configurações" : undefined,
    },
    {
      label: "% da meta",
      value: pctMeta != null ? `${pctMeta.toFixed(0)}%` : "—",
    },
    { label: "Aguardando faturamento", value: String(aguardando) },
  ];

  // ── evolução 12 meses ──
  const buckets = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(ano, mesN - 1 - 11 + i, 1);
    buckets.set(ym(d), 0);
  }
  for (const p of peds) {
    if (!VENDA.includes(p.status)) continue;
    const k = ym(p.data_pedido);
    if (buckets.has(k)) buckets.set(k, buckets.get(k)! + Number(p.valor_total));
  }
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const evolucao = [...buckets.entries()].map(([k, v]) => {
    const m = Number(k.split("-")[1]);
    return { label: MESES[m - 1], value: v };
  });
  const evolucaoMeta = [...buckets.keys()].map((k) => {
    const [a, m] = k.split("-").map(Number);
    const mm =
      (metasRaw ?? []).find(
        (x) =>
          Number(x.ano) === a &&
          Number(x.mes) === m &&
          (opts.vendedorId ? x.vendedor_id === opts.vendedorId : !x.vendedor_id) &&
          (opts.representadaId ? x.representada_id === opts.representadaId : !x.representada_id)
      ) ?? null;
    return mm ? Number(mm.valor_meta) : null;
  });

  // ── vendas por representada (mês) ──
  const porRep = new Map<string, number>();
  for (const p of vendasMes) porRep.set(p.representada_id, (porRep.get(p.representada_id) ?? 0) + Number(p.valor_total));
  const vendasRepresentada: DashBar[] = [...porRep.entries()]
    .map(([id, v]) => ({
      label: repMap.get(id) ?? "—",
      value: v,
      href: `/sistema/representadas/${id}`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ── ABC clientes (12 meses) ──
  const porCli = new Map<string, number>();
  for (const p of peds) {
    if (!VENDA.includes(p.status)) continue;
    porCli.set(p.cliente_id, (porCli.get(p.cliente_id) ?? 0) + Number(p.valor_total));
  }
  const abcCliFull = classificaABC(
    [...porCli.entries()].map(([id, v]) => ({ id, value: v })).sort((a, b) => b.value - a.value)
  );
  const abcClientes: DashBar[] = abcCliFull.slice(0, 8).map((r) => ({
    label: clienteNome.get(r.id) ?? "—",
    value: r.value,
    href: `/sistema/clientes/${r.id}`,
    hint: `Classe ${r.classe}`,
  }));

  // ── ABC produtos (12 meses) ──
  const pedIds = peds.filter((p) => VENDA.includes(p.status)).map((p) => p.id);
  const porProd = new Map<string, { nome: string; value: number }>();
  if (pedIds.length) {
    const { data: itens } = await supabase
      .from("pedido_itens")
      .select("produto_id, sku_snapshot, descricao_snapshot, valor_total")
      .in("pedido_id", pedIds);
    for (const it of itens ?? []) {
      const key = (it.produto_id as string) || (it.sku_snapshot as string) || "?";
      const cur = porProd.get(key) ?? {
        nome: `${it.sku_snapshot ?? ""} ${it.descricao_snapshot ?? ""}`.trim() || "—",
        value: 0,
      };
      cur.value += Number(it.valor_total ?? 0);
      porProd.set(key, cur);
    }
  }
  const abcProdFull = classificaABC(
    [...porProd.values()].sort((a, b) => b.value - a.value).map((r) => ({ ...r }))
  );
  const abcProdutos: DashBar[] = abcProdFull.slice(0, 8).map((r) => ({
    label: r.nome,
    value: r.value,
    hint: `Classe ${r.classe}`,
  }));

  // ── inativos / risco ──
  const classeDe = new Map(abcCliFull.map((r) => [r.id, r.classe]));
  const inativosArr: { id: string; nome: string; dias: number | null }[] = [];
  const riscoArr: { id: string; nome: string; dias: number | null }[] = [];
  for (const c of clientes) {
    if (!["ativo", "reativacao"].includes(c.status as string)) continue;
    const dias = daysSince(c.data_ultima_compra as string | null);
    const inativo = dias == null || dias > 30;
    if (inativo)
      inativosArr.push({
        id: c.id as string,
        nome: clienteNome.get(c.id as string) ?? "—",
        dias,
      });
    if (classeDe.get(c.id as string) === "A" && (dias == null || dias > 45))
      riscoArr.push({
        id: c.id as string,
        nome: clienteNome.get(c.id as string) ?? "—",
        dias,
      });
  }
  const bydays = (a: { dias: number | null }, b: { dias: number | null }) =>
    (b.dias ?? 9999) - (a.dias ?? 9999);

  return {
    cards,
    evolucao,
    evolucaoMeta,
    metaValor,
    vendasRepresentada,
    abcClientes,
    abcProdutos,
    inativos: { count: inativosArr.length, itens: inativosArr.sort(bydays).slice(0, 6) },
    aRisco: { count: riscoArr.length, itens: riscoArr.sort(bydays).slice(0, 6) },
  };
}
