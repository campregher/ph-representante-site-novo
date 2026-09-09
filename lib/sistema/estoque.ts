import { createSistemaClient } from "@/lib/supabase/server";
import type { Fornecedor } from "@/lib/sistema/types";

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

export async function listProdutosProprios(opts: {
  busca?: string;
  baixoEstoque?: boolean;
}): Promise<ProdutoProprioRow[]> {
  const supabase = await createSistemaClient();
  let q = supabase
    .from("produtos")
    .select(
      "id, sku, nome, custo, preco_bruto, estoque_atual, estoque_minimo, ativo, ean, imagem_url, fornecedor:fornecedores(nome)"
    )
    .eq("linha_propria", true)
    .order("nome")
    .limit(2000);
  if (opts.busca) {
    const t = opts.busca.replace(/[%_]/g, "\\$&");
    q = q.or(`sku.ilike.%${t}%,nome.ilike.%${t}%,ean.ilike.%${t}%`);
  }
  const { data } = await q;
  let rows = ((data ?? []) as unknown as (ProdutoProprioRow & { fornecedor: { nome: string } | null })[]).map(
    (r) => ({ ...r, fornecedor: r.fornecedor?.nome ?? null })
  );
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

export async function sellerOptions(): Promise<{ id: string; label: string }[]> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("clientes")
    .select("id, nome_fantasia, razao_social, is_seller, status")
    .eq("is_seller", true)
    .neq("status", "bloqueado")
    .order("nome_fantasia", { ascending: true, nullsFirst: false })
    .limit(2000);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    label: (c.nome_fantasia as string) || (c.razao_social as string) || "—",
  }));
}
