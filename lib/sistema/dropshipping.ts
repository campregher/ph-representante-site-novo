import { createDropshippingClient, createSistemaAdminClient } from "@/lib/supabase/server";
import type { DropFornecedor, DropProdutoRow, DropTabelaCodigo } from "@/lib/sistema/types";

export interface DropPedidoAdmin {
  id: string;
  numero: number;
  status: "aguardando_nf" | "pronto" | "enviado" | "cancelado";
  createdAt: string;
  valorTotal: number;
  sellerNome: string;
  entregaCidade: string | null;
  entregaUf: string | null;
  itens: { sku: string; nome: string; quantidade: number }[];
}

const PEDIDO_ADMIN_COLS =
  "id, numero, status, created_at, cliente_id, valor_total, entrega_cidade, entrega_uf, pedido_itens(quantidade, sku_snapshot, descricao_snapshot)";

/** Visão do admin sobre os pedidos de dropshipping de todos os sellers —
 *  só acompanhamento, nenhuma ação (quem resolve é o próprio seller com o
 *  fornecedor dele). */
export async function listDropPedidos(): Promise<DropPedidoAdmin[]> {
  const drop = await createDropshippingClient();
  const { data } = await drop.from("pedidos").select(PEDIDO_ADMIN_COLS).order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as {
    id: string;
    numero: number;
    status: DropPedidoAdmin["status"];
    created_at: string;
    cliente_id: string;
    valor_total: number;
    entrega_cidade: string | null;
    entrega_uf: string | null;
    pedido_itens: { quantidade: number; sku_snapshot: string | null; descricao_snapshot: string | null }[];
  }[];
  if (rows.length === 0) return [];

  const clienteIds = [...new Set(rows.map((r) => r.cliente_id))];
  const sistema = await createSistemaAdminClient();
  const { data: clientes } = await sistema.from("clientes").select("id, razao_social, nome_fantasia").in("id", clienteIds);
  const nomePorCliente = new Map(
    (clientes ?? []).map((c) => [c.id as string, (c.nome_fantasia as string | null) ?? (c.razao_social as string) ?? "—"])
  );

  return rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    status: r.status,
    createdAt: r.created_at,
    valorTotal: Number(r.valor_total),
    sellerNome: nomePorCliente.get(r.cliente_id) ?? "—",
    entregaCidade: r.entrega_cidade,
    entregaUf: r.entrega_uf,
    itens: r.pedido_itens.map((it) => ({
      sku: it.sku_snapshot ?? "—",
      nome: it.descricao_snapshot ?? "—",
      quantidade: it.quantidade,
    })),
  }));
}

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
  "id, fornecedor_id, sku, nome, descricao, imagem_url, imagens, ml_category_id, ml_category_nome, marca, categoria_interna, variacao, transporte_aceito, estoque_atual, estoque_minimo, ativo, created_at, updated_at, fornecedor:fornecedores(nome), produto_precos(custo, preco_sugerido, tabela:tabelas_preco(codigo))";

type ProdutoPrecoRow = {
  id: string;
  fornecedor_id: string | null;
  sku: string;
  nome: string;
  descricao: string | null;
  imagem_url: string | null;
  imagens: string[] | null;
  ml_category_id: string | null;
  ml_category_nome: string | null;
  marca: string | null;
  categoria_interna: string | null;
  variacao: string | null;
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
    imagens: row.imagens ?? [],
    ml_category_id: row.ml_category_id,
    ml_category_nome: row.ml_category_nome,
    marca: row.marca,
    categoria_interna: row.categoria_interna,
    variacao: row.variacao,
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
