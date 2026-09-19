import { createSistemaClient } from "@/lib/supabase/server";
import type { CategoriaProduto, Fornecedor } from "@/lib/sistema/types";
import { STATUS_VENDA } from "@/lib/sistema/types";
import { margemMinimaEfetiva, precoMinimoVenda } from "@/lib/sistema/preco";

export interface ProdutoProprioRow {
  id: string;
  sku: string;
  nome: string;
  fornecedor: string | null;
  custo: number | null;
  preco_bruto: number | null;
  estoque_atual: number;
  estoque_minimo: number;
  ativo: boolean;
  ean: string | null;
  imagem_url: string | null;
  categoria: string | null;
  margemMinima: number | null;
  precoMinimo: number | null;
}

export async function listFornecedores(soAtivos = false): Promise<Fornecedor[]> {
  const supabase = await createSistemaClient();
  let q = supabase.from("fornecedores").select("*").order("nome");
  if (soAtivos) q = q.eq("ativo", true);
  const { data } = await q;
  return (data as Fornecedor[]) ?? [];
}

export async function getFornecedor(id: string): Promise<Fornecedor | null> {
  const supabase = await createSistemaClient();
  const { data } = await supabase.from("fornecedores").select("*").eq("id", id).maybeSingle();
  return (data as Fornecedor) ?? null;
}

export async function fornecedorOptions(): Promise<{ id: string; label: string }[]> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("fornecedores")
    .select("id, nome, ativo")
    .order("nome");
  return (data ?? []).filter((f) => f.ativo).map((f) => ({ id: f.id as string, label: f.nome as string }));
}

/** Categorias da linha própria (representada_id null) — agrupam produtos
 *  próprios e definem a margem mínima padrão de revenda no drop. */
export async function listCategoriasLinhaPropria(soAtivas = false): Promise<CategoriaProduto[]> {
  const supabase = await createSistemaClient();
  let q = supabase.from("categorias_produtos").select("*").is("representada_id", null).order("nome");
  if (soAtivas) q = q.eq("ativa", true);
  const { data } = await q;
  return (data as CategoriaProduto[]) ?? [];
}

export async function categoriaLinhaPropriaOptions(): Promise<
  { id: string; label: string; margem: number | null }[]
> {
  const cats = await listCategoriasLinhaPropria(true);
  return cats.map((c) => ({ id: c.id, label: c.nome, margem: c.margem_minima_percentual }));
}

export async function listProdutosProprios(opts: {
  busca?: string;
  baixoEstoque?: boolean;
}): Promise<ProdutoProprioRow[]> {
  const supabase = await createSistemaClient();
  let q = supabase
    .from("produtos")
    .select(
      "id, sku, nome, custo, preco_bruto, estoque_atual, estoque_minimo, ativo, ean, imagem_url, margem_minima_percentual, fornecedor:fornecedores(nome), categoria:categorias_produtos(nome, margem_minima_percentual)"
    )
    .eq("linha_propria", true)
    .order("nome")
    .limit(2000);
  if (opts.busca) {
    const t = opts.busca.replace(/[%_]/g, "\\$&");
    q = q.or(`sku.ilike.%${t}%,nome.ilike.%${t}%,ean.ilike.%${t}%`);
  }
  const { data } = await q;
  let rows = (
    (data ?? []) as unknown as (ProdutoProprioRow & {
      fornecedor: { nome: string } | null;
      categoria: { nome: string; margem_minima_percentual: number | null } | null;
      margem_minima_percentual: number | null;
    })[]
  ).map((r) => {
    const margemMinima = margemMinimaEfetiva(r.margem_minima_percentual, r.categoria?.margem_minima_percentual);
    return {
      ...r,
      fornecedor: r.fornecedor?.nome ?? null,
      categoria: r.categoria?.nome ?? null,
      margemMinima,
      precoMinimo: precoMinimoVenda(r.custo, margemMinima),
    };
  });
  if (opts.baixoEstoque) rows = rows.filter((r) => r.estoque_atual <= r.estoque_minimo);
  return rows;
}

export async function getProdutoProprio(id: string) {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("produtos")
    .select("*")
    .eq("id", id)
    .eq("linha_propria", true)
    .maybeSingle();
  return data ?? null;
}

export async function produtoProprioOptions(): Promise<
  { id: string; sku: string; nome: string; preco: number; custo: number; saldo: number }[]
> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("produtos")
    .select("id, sku, nome, preco_bruto, custo, estoque_atual, ativo")
    .eq("linha_propria", true)
    .order("nome")
    .limit(3000);
  return (data ?? [])
    .filter((p) => p.ativo)
    .map((p) => ({
      id: p.id as string,
      sku: p.sku as string,
      nome: p.nome as string,
      preco: Number(p.preco_bruto ?? 0),
      custo: Number(p.custo ?? 0),
      saldo: Number(p.estoque_atual ?? 0),
    }));
}

export async function estoqueKpis() {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("produtos")
    .select("custo, preco_bruto, estoque_atual, estoque_minimo")
    .eq("linha_propria", true)
    .limit(5000);
  const rows = data ?? [];
  let valorCusto = 0;
  let valorVenda = 0;
  let unidades = 0;
  let baixo = 0;
  for (const p of rows) {
    const s = Number(p.estoque_atual ?? 0);
    unidades += s;
    valorCusto += s * Number(p.custo ?? 0);
    valorVenda += s * Number(p.preco_bruto ?? 0);
    if (s <= Number(p.estoque_minimo ?? 0)) baixo += 1;
  }
  return { skus: rows.length, unidades, valorCusto, valorVenda, baixoEstoque: baixo };
}

export interface CompraRow {
  id: string;
  numero_nota: string | null;
  data_compra: string;
  fornecedor: string | null;
  valor_total: number;
  status: string;
  itens: number;
}

export async function listCompras(): Promise<CompraRow[]> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("compras")
    .select("id, numero_nota, data_compra, valor_total, status, fornecedor:fornecedores(nome), compra_itens(id)")
    .order("data_compra", { ascending: false })
    .limit(300);
  return ((data ?? []) as unknown as {
    id: string;
    numero_nota: string | null;
    data_compra: string;
    valor_total: number;
    status: string;
    fornecedor: { nome: string } | null;
    compra_itens: { id: string }[];
  }[]).map((c) => ({
    id: c.id,
    numero_nota: c.numero_nota,
    data_compra: c.data_compra,
    fornecedor: c.fornecedor?.nome ?? null,
    valor_total: Number(c.valor_total),
    status: c.status,
    itens: c.compra_itens?.length ?? 0,
  }));
}

export interface MovimentoRow {
  id: string;
  created_at: string;
  produto: string;
  sku: string;
  tipo: string;
  quantidade: number;
  saldo_apos: number;
  origem_tipo: string | null;
  observacao: string | null;
}

export async function listMovimentos(opts: { produtoId?: string; limit?: number }): Promise<MovimentoRow[]> {
  const supabase = await createSistemaClient();
  let q = supabase
    .from("estoque_movimentos")
    .select("id, created_at, tipo, quantidade, saldo_apos, origem_tipo, observacao, produto:produtos(sku, nome)")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.produtoId) q = q.eq("produto_id", opts.produtoId);
  const { data } = await q;
  return ((data ?? []) as unknown as {
    id: string;
    created_at: string;
    tipo: string;
    quantidade: number;
    saldo_apos: number;
    origem_tipo: string | null;
    observacao: string | null;
    produto: { sku: string; nome: string } | null;
  }[]).map((m) => ({
    id: m.id,
    created_at: m.created_at,
    produto: m.produto?.nome ?? "—",
    sku: m.produto?.sku ?? "",
    tipo: m.tipo,
    quantidade: m.quantidade,
    saldo_apos: m.saldo_apos,
    origem_tipo: m.origem_tipo,
    observacao: m.observacao,
  }));
}

export interface ClienteDropOpt {
  id: string;
  label: string;
  is_seller: boolean;
  documento: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
}

export interface EstoqueParadoRow {
  id: string;
  sku: string;
  nome: string;
  estoqueAtual: number;
  custo: number;
  valorParado: number;
}

export interface EstoqueRelatorio {
  dias: number;
  receita: number;
  custoVendido: number;
  margem: number;
  margemPct: number;
  unidadesVendidas: number;
  estoqueAtualUnidades: number;
  giroAnualizado: number;
  valorParadoTotal: number;
  produtosParados: EstoqueParadoRow[];
  topMargem: { id: string; sku: string; nome: string; margem: number }[];
}

/**
 * Margem, giro e estoque parado da linha própria, com base nas vendas (pedidos
 * tipo=drop_proprio, status de venda) dos últimos `dias` dias. `custo_unitario`
 * usa o snapshot gravado no item na hora da venda (não o custo atual do produto).
 */
export async function estoqueRelatorio(dias = 90): Promise<EstoqueRelatorio> {
  const supabase = await createSistemaClient();
  const corte = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);

  const [{ data: produtos }, { data: itensRaw }] = await Promise.all([
    supabase
      .from("produtos")
      .select("id, sku, nome, custo, estoque_atual")
      .eq("linha_propria", true)
      .eq("ativo", true)
      .limit(5000),
    supabase
      .from("pedido_itens")
      .select("produto_id, quantidade, valor_total, custo_unitario, pedidos!inner(tipo, status, data_pedido)")
      .eq("pedidos.tipo", "drop_proprio")
      .in("pedidos.status", [...STATUS_VENDA])
      .gte("pedidos.data_pedido", corte)
      .limit(10000),
  ]);

  const prods = produtos ?? [];
  const itens = (itensRaw ?? []) as unknown as {
    produto_id: string | null;
    quantidade: number;
    valor_total: number;
    custo_unitario: number | null;
  }[];

  const porProduto = new Map<string, { unidades: number; receita: number; custo: number }>();
  let receita = 0;
  let custoVendido = 0;
  let unidadesVendidas = 0;
  for (const it of itens) {
    if (!it.produto_id) continue;
    const q = Number(it.quantidade) || 0;
    const rec = Number(it.valor_total) || 0;
    const cst = q * Number(it.custo_unitario ?? 0);
    receita += rec;
    custoVendido += cst;
    unidadesVendidas += q;
    const acc = porProduto.get(it.produto_id) ?? { unidades: 0, receita: 0, custo: 0 };
    acc.unidades += q;
    acc.receita += rec;
    acc.custo += cst;
    porProduto.set(it.produto_id, acc);
  }
  const margem = receita - custoVendido;
  const margemPct = receita > 0 ? (margem / receita) * 100 : 0;

  const estoqueAtualUnidades = prods.reduce((s, p) => s + Number(p.estoque_atual ?? 0), 0);
  // giro anualizado ~ quantas vezes o estoque atual "viraria" por ano, no ritmo dos últimos `dias`
  const giroAnualizado =
    estoqueAtualUnidades > 0 ? (unidadesVendidas / dias) * 365 / estoqueAtualUnidades : 0;

  const produtosParados: EstoqueParadoRow[] = [];
  let valorParadoTotal = 0;
  for (const p of prods) {
    const saldo = Number(p.estoque_atual ?? 0);
    if (saldo <= 0) continue;
    if (porProduto.has(p.id as string)) continue; // vendeu no período
    const custo = Number(p.custo ?? 0);
    const valorParado = saldo * custo;
    valorParadoTotal += valorParado;
    produtosParados.push({
      id: p.id as string,
      sku: p.sku as string,
      nome: p.nome as string,
      estoqueAtual: saldo,
      custo,
      valorParado,
    });
  }
  produtosParados.sort((a, b) => b.valorParado - a.valorParado);

  const nomeMap = new Map(prods.map((p) => [p.id as string, { sku: p.sku as string, nome: p.nome as string }]));
  const topMargem = [...porProduto.entries()]
    .map(([id, v]) => ({
      id,
      sku: nomeMap.get(id)?.sku ?? "",
      nome: nomeMap.get(id)?.nome ?? "—",
      margem: v.receita - v.custo,
    }))
    .sort((a, b) => b.margem - a.margem)
    .slice(0, 10);

  return {
    dias,
    receita,
    custoVendido,
    margem,
    margemPct,
    unidadesVendidas,
    estoqueAtualUnidades,
    giroAnualizado,
    valorParadoTotal,
    produtosParados: produtosParados.slice(0, 20),
    topMargem,
  };
}

export interface DespachoRow {
  id: string;
  numero: number;
  dataPedido: string;
  status: string;
  canal: string | null;
  seller: string;
  produtos: string;
  entrega: string | null;
}

/** D8 — fila de despacho: pedidos drop confirmados/faturados que ainda não
 *  saíram (não estão em_transporte/entregue) — precisam ser embalados e
 *  postados. */
export async function listFilaDespacho(): Promise<DespachoRow[]> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("pedidos")
    .select(
      "id, numero, data_pedido, status, canal, entrega_nome, entrega_cidade, entrega_uf, cliente:clientes(nome_fantasia, razao_social), pedido_itens(descricao_snapshot, quantidade)"
    )
    .eq("tipo", "drop_proprio")
    .in("status", ["confirmado", "faturado"])
    .order("data_pedido", { ascending: true })
    .limit(300);

  return (
    (data ?? []) as unknown as {
      id: string;
      numero: number;
      data_pedido: string;
      status: string;
      canal: string | null;
      entrega_nome: string | null;
      entrega_cidade: string | null;
      entrega_uf: string | null;
      cliente: { nome_fantasia: string | null; razao_social: string | null } | null;
      pedido_itens: { descricao_snapshot: string | null; quantidade: number }[];
    }[]
  ).map((r) => ({
    id: r.id,
    numero: r.numero,
    dataPedido: r.data_pedido,
    status: r.status,
    canal: r.canal,
    seller: r.cliente?.nome_fantasia || r.cliente?.razao_social || "—",
    produtos: (r.pedido_itens ?? [])
      .map((it) => `${it.quantidade}x ${it.descricao_snapshot ?? "?"}`)
      .join(", "),
    entrega:
      r.entrega_nome || r.entrega_cidade
        ? [r.entrega_nome, r.entrega_cidade && r.entrega_uf ? `${r.entrega_cidade}/${r.entrega_uf}` : null]
            .filter(Boolean)
            .join(" — ")
        : null,
  }));
}

/** Todos os clientes (sellers + clientes da representação) para o pedido drop. */
export async function clientesParaDrop(): Promise<ClienteDropOpt[]> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("clientes")
    .select(
      "id, nome_fantasia, razao_social, cnpj, cpf, is_seller, status, telefone, whatsapp, cep, logradouro, numero, complemento, bairro, cidade, estado"
    )
    .neq("status", "bloqueado")
    .order("is_seller", { ascending: false })
    .order("nome_fantasia", { ascending: true, nullsFirst: false })
    .limit(3000);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    label: (c.nome_fantasia as string) || (c.razao_social as string) || "—",
    is_seller: !!c.is_seller,
    documento: (c.cnpj as string) || (c.cpf as string) || null,
    telefone: (c.telefone as string) || (c.whatsapp as string) || null,
    cep: (c.cep as string) ?? null,
    logradouro: (c.logradouro as string) ?? null,
    numero: (c.numero as string) ?? null,
    complemento: (c.complemento as string) ?? null,
    bairro: (c.bairro as string) ?? null,
    cidade: (c.cidade as string) ?? null,
    estado: (c.estado as string) ?? null,
  }));
}
