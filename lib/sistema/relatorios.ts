import { createSistemaClient } from "@/lib/supabase/server";
import { STATUS_VENDA } from "@/lib/sistema/types";
import { daysSince } from "@/lib/sistema/format";

const VENDA = [...STATUS_VENDA] as string[];

export interface AbcRow {
  id: string;
  nome: string;
  valor: number;
  pedidos: number;
  pct: number; // participação individual (%)
  pctAcum: number; // acumulado (%)
  classe: "A" | "B" | "C";
}

export interface CurvaABC {
  clientes: AbcRow[];
  produtos: AbcRow[];
  totalClientes: number;
  totalProdutos: number;
  resumoClientes: Record<"A" | "B" | "C", { qtd: number; valor: number }>;
  resumoProdutos: Record<"A" | "B" | "C", { qtd: number; valor: number }>;
}

function montaABC(
  entradas: { id: string; nome: string; valor: number; pedidos: number }[]
): { rows: AbcRow[]; resumo: Record<"A" | "B" | "C", { qtd: number; valor: number }> } {
  const ordenado = entradas.filter((e) => e.valor > 0).sort((a, b) => b.valor - a.valor);
  const total = ordenado.reduce((s, e) => s + e.valor, 0) || 1;
  let acum = 0;
  const resumo = {
    A: { qtd: 0, valor: 0 },
    B: { qtd: 0, valor: 0 },
    C: { qtd: 0, valor: 0 },
  };
  const rows = ordenado.map((e) => {
    acum += e.valor;
    const pctAcum = (acum / total) * 100;
    const classe: "A" | "B" | "C" = pctAcum <= 80 ? "A" : pctAcum <= 95 ? "B" : "C";
    resumo[classe].qtd += 1;
    resumo[classe].valor += e.valor;
    return {
      id: e.id,
      nome: e.nome,
      valor: e.valor,
      pedidos: e.pedidos,
      pct: (e.valor / total) * 100,
      pctAcum,
      classe,
    };
  });
  return { rows, resumo };
}

export async function getCurvaABC(opts: {
  meses?: number;
  representadaId?: string;
  vendedorId?: string;
}): Promise<CurvaABC> {
  const supabase = await createSistemaClient();
  const meses = opts.meses ?? 12;
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth() - (meses - 1), 1);

  let q = supabase
    .from("pedidos")
    .select("id, cliente_id, representada_id, vendedor_id, status, valor_total, data_pedido")
    .gte("data_pedido", inicio.toISOString());
  if (opts.representadaId) q = q.eq("representada_id", opts.representadaId);
  if (opts.vendedorId) q = q.eq("vendedor_id", opts.vendedorId);

  const { data: pedRaw } = await q;
  const peds = ((pedRaw as unknown as
    | {
        id: string;
        cliente_id: string;
        status: string;
        valor_total: number;
      }[]
    | null) ?? []).filter((p) => VENDA.includes(p.status));

  // ── clientes ──
  const porCli = new Map<string, { valor: number; pedidos: number }>();
  for (const p of peds) {
    const cur = porCli.get(p.cliente_id) ?? { valor: 0, pedidos: 0 };
    cur.valor += Number(p.valor_total);
    cur.pedidos += 1;
    porCli.set(p.cliente_id, cur);
  }
  const cliNome = new Map<string, string>();
  const cliIds = [...porCli.keys()];
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
  const cliABC = montaABC(
    cliIds.map((id) => ({
      id,
      nome: cliNome.get(id) ?? "—",
      valor: porCli.get(id)!.valor,
      pedidos: porCli.get(id)!.pedidos,
    }))
  );

  // ── produtos ──
  const pedIds = peds.map((p) => p.id);
  const porProd = new Map<string, { nome: string; valor: number; pedidos: Set<string> }>();
  if (pedIds.length) {
    const { data: itens } = await supabase
      .from("pedido_itens")
      .select("pedido_id, produto_id, sku_snapshot, descricao_snapshot, valor_total")
      .in("pedido_id", pedIds);
    for (const it of itens ?? []) {
      const key = (it.produto_id as string) || (it.sku_snapshot as string) || "?";
      const cur = porProd.get(key) ?? {
        nome: `${it.sku_snapshot ?? ""} ${it.descricao_snapshot ?? ""}`.trim() || "—",
        valor: 0,
        pedidos: new Set<string>(),
      };
      cur.valor += Number(it.valor_total ?? 0);
      cur.pedidos.add(it.pedido_id as string);
      porProd.set(key, cur);
    }
  }
  const prodABC = montaABC(
    [...porProd.entries()].map(([id, v]) => ({
      id,
      nome: v.nome,
      valor: v.valor,
      pedidos: v.pedidos.size,
    }))
  );

  return {
    clientes: cliABC.rows,
    produtos: prodABC.rows,
    totalClientes: cliABC.rows.reduce((s, r) => s + r.valor, 0),
    totalProdutos: prodABC.rows.reduce((s, r) => s + r.valor, 0),
    resumoClientes: cliABC.resumo,
    resumoProdutos: prodABC.resumo,
  };
}

// ───────────────────────────── Clientes sem comprar ─────────────────────────────

export interface FaixaInatividade {
  label: string;
  min: number;
  max: number | null;
  count: number;
  clientes: {
    id: string;
    nome: string;
    dias: number | null;
    ultimaCompra: string | null;
    vendedor: string | null;
  }[];
}

const FAIXAS: { label: string; min: number; max: number | null }[] = [
  { label: "15 a 29 dias", min: 15, max: 30 },
  { label: "30 a 59 dias", min: 30, max: 60 },
  { label: "60 a 89 dias", min: 60, max: 90 },
  { label: "90 a 179 dias", min: 90, max: 180 },
  { label: "180 dias ou mais", min: 180, max: null },
];

export async function getClientesSemComprar(opts: {
  vendedorId?: string;
}): Promise<{ faixas: FaixaInatividade[]; nunca: FaixaInatividade; totalMonitorados: number }> {
  const supabase = await createSistemaClient();
  let q = supabase
    .from("clientes")
    .select("id, nome_fantasia, razao_social, data_ultima_compra, status, vendedor_id");
  if (opts.vendedorId) q = q.eq("vendedor_id", opts.vendedorId);
  const { data } = await q;

  const clientes = (data ?? []).filter((c) =>
    ["ativo", "reativacao"].includes(c.status as string)
  );

  // nomes de vendedores
  const vendIds = [...new Set(clientes.map((c) => c.vendedor_id as string | null).filter(Boolean))] as string[];
  const vendNome = new Map<string, string>();
  if (vendIds.length) {
    const { data: vs } = await supabase.from("profiles").select("id, nome, email").in("id", vendIds);
    for (const v of vs ?? [])
      vendNome.set(v.id as string, (v.nome as string) || (v.email as string) || "—");
  }

  const mk = (label: string, min: number, max: number | null): FaixaInatividade => ({
    label,
    min,
    max,
    count: 0,
    clientes: [],
  });
  const faixas = FAIXAS.map((f) => mk(f.label, f.min, f.max));
  const nunca = mk("Nunca comprou", -1, null);

  for (const c of clientes) {
    const nome = (c.nome_fantasia as string) || (c.razao_social as string) || "—";
    const vendedor = c.vendedor_id ? vendNome.get(c.vendedor_id as string) ?? null : null;
    const ultima = c.data_ultima_compra as string | null;
    if (!ultima) {
      nunca.count += 1;
      nunca.clientes.push({ id: c.id as string, nome, dias: null, ultimaCompra: null, vendedor });
      continue;
    }
    const dias = daysSince(ultima) ?? 0;
    const faixa = faixas.find((f) => dias >= f.min && (f.max == null || dias < f.max));
    if (faixa) {
      faixa.count += 1;
      faixa.clientes.push({ id: c.id as string, nome, dias, ultimaCompra: ultima, vendedor });
    }
  }

  for (const f of [...faixas, nunca]) f.clientes.sort((a, b) => (b.dias ?? 1e9) - (a.dias ?? 1e9));

  return {
    faixas,
    nunca,
    totalMonitorados: clientes.length,
  };
}
