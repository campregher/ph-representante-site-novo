import { createDropshippingClient } from "@/lib/supabase/server";
import type { DropFornecedor, DropProdutoRow, DropTabelaCodigo } from "@/lib/sistema/types";

export async function listDropFornecedores(soAtivos = false): Promise<DropFornecedor[]> {
  const db = await createDropshippingClient();
  let q = db.from("fornecedores").select("*").order("nome");
  if (soAtivos) q = q.eq("ativo", true);
  const { data } = await q;
  return (data as DropFornecedor[]) ?? [];
}

export async function dropFornecedorOptions(): Promise<{ id: string; label: string }[]> {
  const fornecedores = await listDropFornecedores(true);
  return fornecedores.map((f) => ({ id: f.id, label: f.nome }));
}

const PRODUTO_COLS =
  "id, fornecedor_id, sku, nome, descricao, imagem_url, ml_category_id, ml_category_nome, marca, categoria_interna, transporte_aceito, estoque_atual, estoque_minimo, ativo, created_at, updated_at, fornecedor:fornecedores(nome), produto_precos(custo, preco_sugerido, tabela:tabelas_preco(codigo))";

type ProdutoPrecoRow = {
  id: string;
  fornecedor_id: string | null;
  sku: string;
  nome: string;
  descricao: string | null;
  imagem_url: string | null;
  ml_category_id: string | null;
  ml_category_nome: string | null;
  marca: string | null;
  categoria_interna: string | null;
  transporte_aceito: string[] | null;
  estoque_atual: number;
  estoque_minimo: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  fornecedor: { nome: string } | null;
  produto_precos: { custo: number; preco_sugerido: number | null; tabela: { codigo: DropTabelaCodigo } | null }[];
};

function resolvePrecos(row: ProdutoPrecoRow): DropProdutoRow {
  const cnpj = row.produto_precos.find((p) => p.tabela?.codigo === "cnpj");
  return {
    id: row.id,
    fornecedor_id: row.fornecedor_id,
    sku: row.sku,
    nome: row.nome,
    descricao: row.descricao,
    imagem_url: row.imagem_url,
    ml_category_id: row.ml_category_id,
    ml_category_nome: row.ml_category_nome,
    marca: row.marca,
    categoria_interna: row.categoria_interna,
    transporte_aceito: row.transporte_aceito ?? [],
    estoque_atual: row.estoque_atual,
    estoque_minimo: row.estoque_minimo,
    ativo: row.ativo,
    created_at: row.created_at,
    updated_at: row.updated_at,
    fornecedor: row.fornecedor?.nome ?? null,
    custoCnpj: cnpj?.custo ?? null,
    precoSugeridoCnpj: cnpj?.preco_sugerido ?? null,
  };
}

export async function listDropProdutos(opts: { busca?: string } = {}): Promise<DropProdutoRow[]> {
  const db = await createDropshippingClient();
  let q = db.from("produtos").select(PRODUTO_COLS).order("nome").limit(2000);
  if (opts.busca) {
    const t = opts.busca.replace(/[%_]/g, "\\$&");
    q = q.or(`sku.ilike.%${t}%,nome.ilike.%${t}%`);
  }
  const { data } = await q;
  return ((data ?? []) as unknown as ProdutoPrecoRow[]).map(resolvePrecos);
}

export async function getDropProduto(id: string): Promise<DropProdutoRow | null> {
  const db = await createDropshippingClient();
  const { data } = await db.from("produtos").select(PRODUTO_COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  return resolvePrecos(data as unknown as ProdutoPrecoRow);
}

export async function dropTabelaIds(): Promise<Record<DropTabelaCodigo, string>> {
  const db = await createDropshippingClient();
  const { data } = await db.from("tabelas_preco").select("id, codigo");
  const map: Record<string, string> = {};
  for (const t of data ?? []) map[t.codigo as string] = t.id as string;
  return map as Record<DropTabelaCodigo, string>;
}
