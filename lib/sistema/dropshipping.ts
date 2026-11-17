import { createDropshippingClient, createDropshippingAdminClient, createSistemaAdminClient } from "@/lib/supabase/server";
import type { DropFornecedor, DropProdutoRow, DropTabelaCodigo } from "@/lib/sistema/types";
import { buscarMensagensPedido, type MensagemPedido } from "@/lib/sistema/dropshipping-pedido-arquivos";
import { atualizarEnvioEDevolucaoPedido, precisaChecarEnvio } from "@/lib/sistema/dropshipping-pedido-envio-status";
import { onlyDigits } from "@/lib/sistema/format";

export interface DropPedidoAdmin {
  id: string;
  numero: number;
  status: "aguardando_nf" | "pronto" | "enviado" | "cancelado";
  createdAt: string;
  valorTotal: number;
  sellerNome: string;
  entregaCidade: string | null;
  entregaUf: string | null;
  itens: { sku: string; nome: string; quantidade: number; caixas: number }[];
  /** Status REAL do Mercado Livre (envio físico/devolução) — diferente de
   *  `status` acima, que é só o repasse ao fornecedor. Ver
   *  dropshipping-pedido-envio-status.ts. */
  mlShippingStatus: string | null;
  mlShippingSubstatus: string | null;
  prazoEnvio: string | null;
  devolucaoStatus: string | null;
  devolucaoMotivo: string | null;
}

const PEDIDO_ADMIN_COLS =
  "id, numero, status, canal, created_at, cliente_id, ml_conta_id, ml_shipping_id, pedido_externo, valor_total, entrega_cidade, entrega_uf, ml_shipping_status, ml_shipping_substatus, ml_prazo_envio, ml_envio_atualizado_em, devolucao_status, devolucao_motivo, pedido_itens(quantidade, sku_snapshot, descricao_snapshot, unidades_por_kit)";

/** Visão do admin sobre os pedidos de dropshipping de todos os sellers —
 *  só acompanhamento, nenhuma ação (quem resolve é o próprio seller com o
 *  fornecedor dele). */
/** Só mostra pedidos com etiqueta já liberada ("pronto"/"enviado") — o admin
 *  acompanha o que já está pronto pra seguir, não a fila de quem ainda está
 *  esperando o seller declarar a NF no Mercado Livre. */
export async function listDropPedidos(): Promise<DropPedidoAdmin[]> {
  const drop = await createDropshippingClient();
  const { data } = await drop
    .from("pedidos")
    .select(PEDIDO_ADMIN_COLS)
    .in("status", ["pronto", "enviado"])
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as {
    id: string;
    numero: number;
    status: DropPedidoAdmin["status"];
    canal: string;
    created_at: string;
    cliente_id: string;
    ml_conta_id: string | null;
    ml_shipping_id: number | null;
    pedido_externo: string | null;
    valor_total: number;
    entrega_cidade: string | null;
    entrega_uf: string | null;
    ml_shipping_status: string | null;
    ml_shipping_substatus: string | null;
    ml_prazo_envio: string | null;
    ml_envio_atualizado_em: string | null;
    devolucao_status: string | null;
    devolucao_motivo: string | null;
    pedido_itens: { quantidade: number; sku_snapshot: string | null; descricao_snapshot: string | null; unidades_por_kit: number }[];
  }[];
  if (rows.length === 0) return [];

  // checagem on-demand (throttlada) do status real de envio/devolução — usa o
  // client admin (service role) só pra esse update pontual, pra não depender
  // de policy de escrita de RLS pro staff em `dropshipping.pedidos`.
  const pedidosParaChecar = rows.filter(precisaChecarEnvio);
  if (pedidosParaChecar.length > 0) {
    const dropAdmin = await createDropshippingAdminClient();
    await Promise.all(
      pedidosParaChecar.map(async (p) => {
        try {
          const patch = await atualizarEnvioEDevolucaoPedido(dropAdmin, p);
          Object.assign(p, patch);
        } catch (e) {
          console.error("[dropshipping] atualizarEnvioEDevolucaoPedido:", e);
        }
      })
    );
  }

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
    mlShippingStatus: r.ml_shipping_status,
    mlShippingSubstatus: r.ml_shipping_substatus,
    prazoEnvio: r.ml_prazo_envio,
    devolucaoStatus: r.devolucao_status,
    devolucaoMotivo: r.devolucao_motivo,
    itens: r.pedido_itens.map((it) => ({
      sku: it.sku_snapshot ?? "—",
      nome: it.descricao_snapshot ?? "—",
      quantidade: it.quantidade,
      caixas: it.quantidade * (it.unidades_por_kit || 1),
    })),
  }));
}

export interface DropPedidoDetalheItem {
  sku: string;
  nome: string;
  quantidade: number;
  caixas: number;
  precoVenda: number;
  comissaoMl: number;
  custoUnitario: number;
}

export interface DropPedidoDetalhe {
  id: string;
  numero: number;
  status: "aguardando_nf" | "pronto" | "enviado" | "cancelado";
  createdAt: string;
  canal: string;
  pedidoExterno: string | null;
  sellerNome: string;
  itens: DropPedidoDetalheItem[];
  valorTotal: number;
  frete: number | null;
  comissaoTotal: number;
  custoTotal: number;
  entrega: {
    nome: string | null;
    telefone: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
  };
  arquivos: { etiquetaPronta: boolean; danfePronta: boolean; planilhaPronta: boolean };
  mensagens: MensagemPedido[];
}

const PEDIDO_DETALHE_COLS =
  "id, numero, status, created_at, cliente_id, canal, pedido_externo, ml_conta_id, valor_total, ml_frete, entrega_nome, entrega_telefone, entrega_cep, entrega_logradouro, entrega_numero, entrega_complemento, entrega_bairro, entrega_cidade, entrega_uf, etiqueta_path, danfe_path, planilha_path, pedido_itens(quantidade, sku_snapshot, descricao_snapshot, unidades_por_kit, custo_unitario, ml_preco_venda, ml_comissao)";

/** Detalhe completo de UM pedido, visão do admin — venda, recebimento,
 *  entrega e mensagens trocadas com o comprador no Mercado Livre. */
export async function getDropPedidoDetalhe(id: string): Promise<DropPedidoDetalhe | null> {
  const drop = await createDropshippingClient();
  const { data } = await drop.from("pedidos").select(PEDIDO_DETALHE_COLS).eq("id", id).maybeSingle();
  if (!data) return null;

  const r = data as unknown as {
    id: string;
    numero: number;
    status: DropPedidoDetalhe["status"];
    created_at: string;
    cliente_id: string;
    canal: string;
    pedido_externo: string | null;
    ml_conta_id: string | null;
    valor_total: number;
    ml_frete: number | null;
    entrega_nome: string | null;
    entrega_telefone: string | null;
    entrega_cep: string | null;
    entrega_logradouro: string | null;
    entrega_numero: string | null;
    entrega_complemento: string | null;
    entrega_bairro: string | null;
    entrega_cidade: string | null;
    entrega_uf: string | null;
    etiqueta_path: string | null;
    danfe_path: string | null;
    planilha_path: string | null;
    pedido_itens: {
      quantidade: number;
      sku_snapshot: string | null;
      descricao_snapshot: string | null;
      unidades_por_kit: number;
      custo_unitario: number;
      ml_preco_venda: number;
      ml_comissao: number;
    }[];
  };

  const sistema = await createSistemaAdminClient();
  const { data: cliente } = await sistema.from("clientes").select("razao_social, nome_fantasia").eq("id", r.cliente_id).maybeSingle();
  const sellerNome = (cliente?.nome_fantasia as string | null) ?? (cliente?.razao_social as string | null) ?? "—";

  const mensagens =
    r.ml_conta_id && r.pedido_externo ? await buscarMensagensPedido(r.ml_conta_id, r.pedido_externo) : [];

  const itens = r.pedido_itens.map((it) => ({
    sku: it.sku_snapshot ?? "—",
    nome: it.descricao_snapshot ?? "—",
    quantidade: it.quantidade,
    caixas: it.quantidade * (it.unidades_por_kit || 1),
    precoVenda: Number(it.ml_preco_venda),
    comissaoMl: Number(it.ml_comissao),
    custoUnitario: Number(it.custo_unitario),
  }));

  return {
    id: r.id,
    numero: r.numero,
    status: r.status,
    createdAt: r.created_at,
    canal: r.canal,
    pedidoExterno: r.pedido_externo,
    sellerNome,
    itens,
    valorTotal: Number(r.valor_total),
    frete: r.ml_frete != null ? Number(r.ml_frete) : null,
    comissaoTotal: itens.reduce((s, it) => s + it.comissaoMl, 0),
    custoTotal: itens.reduce((s, it) => s + it.custoUnitario * it.quantidade, 0),
    entrega: {
      nome: r.entrega_nome,
      telefone: r.entrega_telefone,
      cep: r.entrega_cep,
      logradouro: r.entrega_logradouro,
      numero: r.entrega_numero,
      complemento: r.entrega_complemento,
      bairro: r.entrega_bairro,
      cidade: r.entrega_cidade,
      uf: r.entrega_uf,
    },
    arquivos: {
      etiquetaPronta: !!r.etiqueta_path,
      danfePronta: !!r.danfe_path,
      planilhaPronta: !!r.planilha_path,
    },
    mensagens,
  };
}

/** Fornecedor de dropshipping normalmente já é uma representada da PH (mesmo
 *  CNPJ, importado por `importarFornecedoresRepresentadas`) — em vez de pedir
 *  upload de logo de novo aqui, busca o logo já cadastrado lá (`comercial.
 *  representadas.logo_url`), casando por CNPJ (dígitos). Sem CNPJ ou sem
 *  representada correspondente, fica `null` (ver fallback de ícone na UI). */
async function resolverLogosFornecedores<T extends { cnpj: string | null }>(fornecedores: T[]): Promise<Map<T, string | null>> {
  const resultado = new Map<T, string | null>();
  const cnpjs = [...new Set(fornecedores.map((f) => (f.cnpj ? onlyDigits(f.cnpj) : null)).filter((c): c is string => !!c))];
  if (cnpjs.length === 0) {
    for (const f of fornecedores) resultado.set(f, null);
    return resultado;
  }
  const sistema = await createSistemaAdminClient();
  const { data } = await sistema.from("representadas").select("cnpj, logo_url").in("cnpj", cnpjs);
  const logoPorCnpj = new Map((data ?? []).map((r) => [r.cnpj as string, r.logo_url as string | null]));
  for (const f of fornecedores) {
    resultado.set(f, f.cnpj ? (logoPorCnpj.get(onlyDigits(f.cnpj)) ?? null) : null);
  }
  return resultado;
}

export async function listDropFornecedores(soAtivos = false): Promise<DropFornecedor[]> {
  const db = await createDropshippingClient();
  let q = db.from("fornecedores").select("*").order("nome");
  if (soAtivos) q = q.eq("ativo", true);
  const { data } = await q;
  const fornecedores = (data as Omit<DropFornecedor, "logo_url">[]) ?? [];
  const logos = await resolverLogosFornecedores(fornecedores);
  return fornecedores.map((f) => ({ ...f, logo_url: logos.get(f) ?? null }));
}

export async function dropFornecedorOptions(): Promise<{ id: string; label: string }[]> {
  const fornecedores = await listDropFornecedores(true);
  return fornecedores.map((f) => ({ id: f.id, label: f.nome }));
}

const PRODUTO_COLS =
  "id, fornecedor_id, sku, nome, descricao, imagem_url, imagens, ml_category_id, ml_category_nome, marca, categoria_interna, variacao, transporte_aceito, estoque_atual, estoque_minimo, unidades_por_kit, ativo, created_at, updated_at, fornecedor:fornecedores(nome), produto_precos(custo, preco_sugerido, tabela:tabelas_preco(codigo))";

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
  unidades_por_kit: number;
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
    unidades_por_kit: row.unidades_por_kit,
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
