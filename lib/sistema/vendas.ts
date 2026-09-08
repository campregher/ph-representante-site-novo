import { createSistemaClient } from "@/lib/supabase/server";
import { representadaLabelMap, profileLabelMap } from "@/lib/sistema/queries";
import { STATUS_VENDA, PEDIDO_STATUS_OPTIONS } from "@/lib/sistema/types";

const VENDA = [...STATUS_VENDA] as string[];
const STATUS_LABEL = new Map<string, string>(
  PEDIDO_STATUS_OPTIONS.map((o) => [o.value, o.label])
);

export interface VendasPeriodo {
  key: string;
  label: string;
  inicio: Date;
  fim: Date;
}

export const PERIODO_OPTIONS = [
  { value: "mes", label: "Este mês" },
  { value: "mes_ant", label: "Mês passado" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "ano", label: "Este ano" },
  { value: "12m", label: "Últimos 12 meses" },
] as const;

export function resolvePeriodo(key: string | undefined): VendasPeriodo {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  const d0 = (dt: Date) => {
    dt.setHours(0, 0, 0, 0);
    return dt;
  };
  const amanha = d0(new Date(y, m, hoje.getDate() + 1));
  switch (key) {
    case "mes_ant":
      return {
        key: "mes_ant",
        label: "Mês passado",
        inicio: d0(new Date(y, m - 1, 1)),
        fim: d0(new Date(y, m, 1)),
      };
    case "30":
      return { key: "30", label: "Últimos 30 dias", inicio: d0(new Date(y, m, hoje.getDate() - 29)), fim: amanha };
    case "90":
      return { key: "90", label: "Últimos 90 dias", inicio: d0(new Date(y, m, hoje.getDate() - 89)), fim: amanha };
    case "ano":
      return { key: "ano", label: "Este ano", inicio: d0(new Date(y, 0, 1)), fim: amanha };
    case "12m":
      return { key: "12m", label: "Últimos 12 meses", inicio: d0(new Date(y, m - 11, 1)), fim: amanha };
    case "mes":
    default:
      return { key: "mes", label: "Este mês", inicio: d0(new Date(y, m, 1)), fim: amanha };
  }
}

export interface VendasBar {
  label: string;
  value: number;
  href?: string;
  hint?: string;
}
export interface VendasLinha {
  id: string;
  numero: number;
  data: string;
  cliente: string;
  representada: string;
  vendedor: string;
  status: string;
  itens: number;
  subtotal: number;
  desconto: number;
  total: number;
}

export interface VendasData {
  periodoLabel: string;
  kpis: {
    faturamento: number;
    pedidos: number;
    ticket: number;
    itens: number;
    descontoMedioPct: number;
    clientes: number;
  };
  serie: { label: string; value: number }[];
  serieGranularidade: "dia" | "mes";
  porRepresentada: VendasBar[];
  porVendedor: VendasBar[];
  porStatus: VendasBar[];
  topProdutos: VendasBar[];
  topClientes: VendasBar[];
  linhas: VendasLinha[];
}

function ymd(d: string | Date): string {
  if (typeof d === "string") {
    const m = d.match(/^\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
  }
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export async function getVendas(opts: {
  periodo?: string;
  representadaId?: string;
  vendedorId?: string;
}): Promise<VendasData> {
  const supabase = await createSistemaClient();
  const p = resolvePeriodo(opts.periodo);

  let q = supabase
    .from("pedidos")
    .select(
      "id, numero, cliente_id, representada_id, vendedor_id, status, subtotal, desconto_valor, valor_total, data_pedido"
    )
    .gte("data_pedido", p.inicio.toISOString())
    .lt("data_pedido", p.fim.toISOString())
    .order("data_pedido", { ascending: false });
  if (opts.representadaId) q = q.eq("representada_id", opts.representadaId);
  if (opts.vendedorId) q = q.eq("vendedor_id", opts.vendedorId);

  const [{ data: pedRaw }, repMap, profMap] = await Promise.all([
    q,
    representadaLabelMap(),
    profileLabelMap(),
  ]);

  const peds = ((pedRaw as unknown as
    | {
        id: string;
        numero: number;
        cliente_id: string;
        representada_id: string;
        vendedor_id: string | null;
        status: string;
        subtotal: number;
        desconto_valor: number;
        valor_total: number;
        data_pedido: string;
      }[]
    | null) ?? []).filter((x) => VENDA.includes(x.status));

  // nomes de clientes
  const cliIds = [...new Set(peds.map((x) => x.cliente_id))];
  const cliNome = new Map<string, string>();
  if (cliIds.length) {
    const { data: clis } = await supabase
      .from("clientes")
      .select("id, nome_fantasia, razao_social")
      .in("id", cliIds);
    for (const c of clis ?? [])
      cliNome.set(
        c.id as string,
        (c.nome_fantasia as string) || (c.razao_social as string) || "—"
      );
  }

  // itens (para top produtos + contagem por pedido)
  const pedIds = peds.map((x) => x.id);
  const itensPorPedido = new Map<string, number>();
  const porProduto = new Map<string, { nome: string; value: number }>();
  if (pedIds.length) {
    const { data: itens } = await supabase
      .from("pedido_itens")
      .select("pedido_id, produto_id, sku_snapshot, descricao_snapshot, quantidade, valor_total")
      .in("pedido_id", pedIds);
    for (const it of itens ?? []) {
      const pid = it.pedido_id as string;
      itensPorPedido.set(pid, (itensPorPedido.get(pid) ?? 0) + 1);
      const key = (it.produto_id as string) || (it.sku_snapshot as string) || "?";
      const cur = porProduto.get(key) ?? {
        nome:
          `${it.sku_snapshot ?? ""} ${it.descricao_snapshot ?? ""}`.trim() || "—",
        value: 0,
      };
      cur.value += Number(it.valor_total ?? 0);
      porProduto.set(key, cur);
    }
  }

  // KPIs
  const faturamento = peds.reduce((s, x) => s + Number(x.valor_total), 0);
  const subtotalTot = peds.reduce((s, x) => s + Number(x.subtotal || 0), 0);
  const descTot = peds.reduce((s, x) => s + Number(x.desconto_valor || 0), 0);
  const pedidos = peds.length;
  const ticket = pedidos ? faturamento / pedidos : 0;
  const itensTot = [...itensPorPedido.values()].reduce((s, n) => s + n, 0);
  const descontoMedioPct = subtotalTot ? (descTot / subtotalTot) * 100 : 0;
  const clientes = cliIds.length;

  // série temporal
  const dias = Math.round((p.fim.getTime() - p.inicio.getTime()) / 86_400_000);
  const granularidade: "dia" | "mes" = dias > 92 ? "mes" : "dia";
  const buckets = new Map<string, number>();
  if (granularidade === "dia") {
    for (let t = p.inicio.getTime(); t < p.fim.getTime(); t += 86_400_000) {
      buckets.set(ymd(new Date(t)), 0);
    }
    for (const x of peds) {
      const k = ymd(x.data_pedido);
      if (buckets.has(k)) buckets.set(k, buckets.get(k)! + Number(x.valor_total));
    }
  } else {
    const cur = new Date(p.inicio.getFullYear(), p.inicio.getMonth(), 1);
    while (cur < p.fim) {
      buckets.set(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`, 0);
      cur.setMonth(cur.getMonth() + 1);
    }
    for (const x of peds) {
      const k = ymd(x.data_pedido).slice(0, 7);
      if (buckets.has(k)) buckets.set(k, buckets.get(k)! + Number(x.valor_total));
    }
  }
  const MES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const serie = [...buckets.entries()].map(([k, v]) => {
    if (granularidade === "dia") {
      const [, mm, dd] = k.split("-");
      return { label: `${dd}/${mm}`, value: v };
    }
    const mm = Number(k.split("-")[1]);
    return { label: MES_ABBR[mm - 1], value: v };
  });

  // por representada
  const porRep = new Map<string, number>();
  for (const x of peds) porRep.set(x.representada_id, (porRep.get(x.representada_id) ?? 0) + Number(x.valor_total));
  const porRepresentada = [...porRep.entries()]
    .map(([id, v]) => ({ label: repMap.get(id) ?? "—", value: v, href: `/sistema/representadas/${id}` }))
    .sort((a, b) => b.value - a.value);

  // por vendedor
  const porVend = new Map<string, number>();
  for (const x of peds) {
    const k = x.vendedor_id ?? "—";
    porVend.set(k, (porVend.get(k) ?? 0) + Number(x.valor_total));
  }
  const porVendedor = [...porVend.entries()]
    .map(([id, v]) => ({ label: id === "—" ? "Sem vendedor" : profMap.get(id) ?? "—", value: v }))
    .sort((a, b) => b.value - a.value);

  // por status
  const porStat = new Map<string, number>();
  for (const x of peds) porStat.set(x.status, (porStat.get(x.status) ?? 0) + Number(x.valor_total));
  const porStatus = [...porStat.entries()]
    .map(([s, v]) => ({ label: STATUS_LABEL.get(s) ?? s, value: v }))
    .sort((a, b) => b.value - a.value);

  // top produtos / clientes
  const topProdutos = [...porProduto.values()]
    .map((r) => ({ label: r.nome, value: r.value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const porCli = new Map<string, number>();
  for (const x of peds) porCli.set(x.cliente_id, (porCli.get(x.cliente_id) ?? 0) + Number(x.valor_total));
  const topClientes = [...porCli.entries()]
    .map(([id, v]) => ({ label: cliNome.get(id) ?? "—", value: v, href: `/sistema/clientes/${id}` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // linhas (tabela + CSV)
  const linhas: VendasLinha[] = peds.map((x) => ({
    id: x.id,
    numero: x.numero,
    data: ymd(x.data_pedido),
    cliente: cliNome.get(x.cliente_id) ?? "—",
    representada: repMap.get(x.representada_id) ?? "—",
    vendedor: x.vendedor_id ? profMap.get(x.vendedor_id) ?? "—" : "—",
    status: STATUS_LABEL.get(x.status) ?? x.status,
    itens: itensPorPedido.get(x.id) ?? 0,
    subtotal: Number(x.subtotal || 0),
    desconto: Number(x.desconto_valor || 0),
    total: Number(x.valor_total),
  }));

  return {
    periodoLabel: p.label,
    kpis: { faturamento, pedidos, ticket, itens: itensTot, descontoMedioPct, clientes },
    serie,
    serieGranularidade: granularidade,
    porRepresentada,
    porVendedor,
    porStatus,
    topProdutos,
    topClientes,
    linhas,
  };
}
