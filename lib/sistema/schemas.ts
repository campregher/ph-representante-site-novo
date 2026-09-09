import { z } from "zod";
import { parseNumeroBR } from "./format";

/** string opcional que vira null quando vazia */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

/**
 * Percentual (comissão, desconto de tabela, etc.): aceita "12,5" ou "12.5"
 * — o ponto é tratado como separador decimal (vira vírgula). Vazio → null.
 */
const percentualOpcional = z
  .union([z.number(), z.string()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null;
    return parseNumeroBR(v);
  })
  .nullable()
  .optional();

/** normaliza checkbox-group do RHF (array | string | false) para string[] */
const stringArray = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []),
  z.array(z.string())
);

/** número opcional aceitando "" | number */
const optionalNumber = z
  .union([z.number(), z.string()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  })
  .nullable()
  .optional();

// ─────────────────────────────── Representada ───────────────────────────────
export const representadaSchema = z.object({
  razao_social: z.string().trim().min(2, "Informe a razão social"),
  nome_fantasia: optionalText,
  cnpj: optionalText,
  inscricao_estadual: optionalText,
  telefone: optionalText,
  whatsapp: optionalText,
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido"),
  site: optionalText,
  contato_comercial: optionalText,
  contato_financeiro: optionalText,
  cep: optionalText,
  logradouro: optionalText,
  numero: optionalText,
  complemento: optionalText,
  bairro: optionalText,
  cidade: optionalText,
  estado: optionalText,
  pedido_minimo: optionalNumber,
  percentual_comissao_padrao: percentualOpcional,
  desconto_maximo_padrao: percentualOpcional,
  prazo_pagamento_padrao: optionalText,
  prazo_entrega: optionalText,
  logo_url: optionalText,
  observacoes: optionalText,
  modalidades: stringArray.refine((a) => a.length > 0, "Selecione ao menos uma modalidade"),
  dropship_faturamento: optionalText,
  dropship_condicoes_pagamento: stringArray,
  dropship_observacoes: optionalText,
  ativa: z.boolean().default(true),
});
export type RepresentadaInput = z.input<typeof representadaSchema>;
export type RepresentadaValues = z.output<typeof representadaSchema>;

// ──────────────────────────────── Categoria ────────────────────────────────
export const categoriaSchema = z.object({
  representada_id: z.string().uuid("Selecione a representada"),
  nome: z.string().trim().min(2, "Informe o nome"),
  descricao: optionalText,
});

/** Um eixo de variação: nome + lista de valores possíveis. */
export const variacaoEixoSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do eixo"),
  valores: z.array(z.string().trim().min(1)).default([]),
});

// ───────────────────────────────── Produto ─────────────────────────────────
export const produtoSchema = z.object({
  representada_id: z.string().uuid("Selecione a representada"),
  categoria_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  sku: z.string().trim().min(1, "Informe o SKU"),
  codigo_fabrica: optionalText,
  ean: optionalText,
  ncm: optionalText,
  nome: z.string().trim().min(2, "Informe o nome"),
  descricao: optionalText,
  marca: optionalText,
  aplicacao: optionalText,
  montadora: optionalText,
  modelo: optionalText,
  ano_inicio: optionalNumber,
  ano_fim: optionalNumber,
  unidade: optionalText,
  peso: optionalNumber,
  preco_bruto: optionalNumber,
  altura: optionalNumber,
  largura: optionalNumber,
  comprimento: optionalNumber,
  imagem_url: optionalText,
  observacoes: optionalText,
  ativo: z.boolean().default(true),
  tem_variacoes: z.boolean().default(false),
  variacao_eixos: z.array(variacaoEixoSchema).default([]),
});
export type ProdutoInput = z.input<typeof produtoSchema>;
export type ProdutoValues = z.output<typeof produtoSchema>;

// ─────────────────────────────── Variações ─────────────────────────────────
export const produtoVariacaoSchema = z.object({
  sku: z.string().trim().min(1, "Informe o SKU da variação"),
  atributos: z.record(z.string(), z.string()).default({}),
  preco_bruto: optionalNumber,
  codigo_fabrica: optionalText,
  ean: optionalText,
  imagem_url: optionalText,
  peso: optionalNumber,
  ativo: z.boolean().default(true),
  ordem: z.number().int().default(0),
  observacoes: optionalText,
});
export type ProdutoVariacaoInput = z.input<typeof produtoVariacaoSchema>;

export const salvarVariacoesSchema = z.object({
  produto_id: z.string().uuid("Produto inválido"),
  eixos: z.array(variacaoEixoSchema).default([]),
  variacoes: z.array(produtoVariacaoSchema).default([]),
});

// ────────────────────────────── Tabela de Preço ─────────────────────────────
export const tabelaSchema = z.object({
  representada_id: z.string().uuid("Selecione a representada"),
  nome: z.string().trim().min(2, "Informe o nome da tabela"),
  descricao: optionalText,
  tipo: optionalText,
  desconto_percentual: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === "number" ? v : parseNumeroBR(v);
      return n != null && Number.isFinite(n) ? Math.min(Math.max(n, 0), 100) : 0;
    })
    .default(0),
  data_inicio: optionalText,
  data_fim: optionalText,
  ativa: z.boolean().default(true),
});
export type TabelaInput = z.input<typeof tabelaSchema>;
export type TabelaValues = z.output<typeof tabelaSchema>;

// ───────────────────────────────── Cliente ─────────────────────────────────
const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido");

export const clienteSchema = z
  .object({
    tipo_pessoa: z.enum(["juridica", "fisica"]).default("juridica"),
    cnpj: optionalText,
    cpf: optionalText,
    razao_social: optionalText,
    nome_fantasia: optionalText,
    inscricao_estadual: optionalText,
    telefone: optionalText,
    whatsapp: optionalText,
    email: optionalEmail,
    site: optionalText,
    cep: optionalText,
    logradouro: optionalText,
    numero: optionalText,
    complemento: optionalText,
    bairro: optionalText,
    cidade: optionalText,
    estado: optionalText,
    vendedor_id: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
    limite_credito: optionalNumber,
    status: z
      .enum(["prospect", "ativo", "inativo", "bloqueado", "reativacao"])
      .default("prospect"),
    is_seller: z.coerce.boolean().default(false),
    observacoes: optionalText,
  })
  .refine((d) => !!(d.razao_social || d.nome_fantasia), {
    message: "Informe a razão social ou o nome do cliente",
    path: ["razao_social"],
  });
export type ClienteInput = z.input<typeof clienteSchema>;
export type ClienteValues = z.output<typeof clienteSchema>;

export const clienteContatoSchema = z.object({
  cliente_id: z.string().uuid(),
  nome: z.string().trim().min(2, "Informe o nome"),
  cargo: optionalText,
  telefone: optionalText,
  whatsapp: optionalText,
  email: optionalEmail,
  principal: z.boolean().default(false),
});

export const clienteRepresentadaSchema = z.object({
  cliente_id: z.string().uuid(),
  representada_id: z.string().uuid("Selecione a representada"),
  tabela_preco_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  condicao_pagamento: optionalText,
  desconto_padrao: percentualOpcional,
  limite_credito: optionalNumber,
  observacoes: optionalText,
});

// ───────────────────────────────── Pedido ──────────────────────────────────
export const pedidoItemInput = z.object({
  produto_id: z.string().uuid(),
  variacao_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  sku_snapshot: z.string(),
  descricao_snapshot: z.string(),
  quantidade: z.number().positive("Quantidade inválida"),
  preco_tabela: z.number().nonnegative(),
  desconto_item_percentual: z.number().min(0).max(100).default(0),
});

export const pedidoSchema = z.object({
  cliente_id: z.string().uuid("Selecione o cliente"),
  representada_id: z.string().uuid("Selecione a representada"),
  tabela_preco_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  vendedor_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  condicao_pagamento: optionalText,
  forma_pagamento: optionalText,
  previsao_entrega: optionalText,
  observacao_cliente: optionalText,
  observacao_representada: optionalText,
  observacao_interna: optionalText,
  desconto_modo: z.enum(["percentual", "valor"]).default("percentual"),
  desconto_input: z.number().min(0).default(0),
  itens: z.array(pedidoItemInput).min(1, "Adicione ao menos um produto"),
});
export type PedidoFormValues = z.infer<typeof pedidoSchema>;

// ─────────────────────────── Configurações ─────────────────────────────────
export const meuPerfilSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome"),
  telefone: optionalText,
});

export const empresaConfigSchema = z.object({
  empresa_nome: z.string().trim().min(2, "Informe o nome da empresa"),
  whatsapp: optionalText,
  telefone: optionalText,
  email: optionalEmail,
  cnpj: optionalText,
  endereco: optionalText,
  cidade: optionalText,
  site: optionalText,
  observacoes_padrao_pedido: optionalText,
});

const valorMeta = z
  .union([z.number(), z.string()])
  .transform((v) => {
    const n =
      typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });

export const metaGeralSchema = z.object({
  ano: z.coerce.number().int().min(2020).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  valor_meta: valorMeta,
});

export const metaVendedorSchema = z.object({
  ano: z.coerce.number().int().min(2020).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  vendedor_id: z.string().uuid("Selecione o vendedor"),
  representada_id: optionalText,
  valor_meta: valorMeta,
});

// ──────────────────────────────── Tarefas ──────────────────────────────────
export const tarefaSchema = z.object({
  titulo: z.string().trim().min(2, "Informe um título"),
  descricao: optionalText,
  tipo: z.enum(["ligacao", "whatsapp", "email", "visita", "reuniao", "followup", "outro"]),
  cliente_id: optionalText,
  representada_id: optionalText,
  pedido_id: optionalText,
  responsavel_id: optionalText,
  data_prevista: optionalText,
  prioridade: z.enum(["baixa", "media", "alta"]),
  status: z.enum(["pendente", "em_andamento", "concluida", "cancelada"]),
});

// ───────────────────────────── CRM / Oportunidades ─────────────────────────
export const oportunidadeSchema = z.object({
  cliente_id: z.string().uuid("Selecione o cliente"),
  responsavel_id: optionalText,
  etapa: z.enum([
    "prospect",
    "primeiro_contato",
    "apresentacao",
    "tabela_enviada",
    "negociacao",
    "primeiro_pedido",
    "cliente_ativo",
    "perdido",
  ]),
  representada_id: optionalText,
  valor_estimado: optionalNumber,
  proxima_acao: optionalText,
  data_proxima_acao: optionalText,
  observacoes: optionalText,
});

// ───────────────────────── Importação de produtos ──────────────────────────
export const importRowSchema = z.object({
  sku: z.string().trim().min(1),
  nome: z.string().trim().optional().default(""),
  descricao: z.string().trim().optional().default(""),
  preco: z.number().nullable().optional(),
});

// ═══════════════════════════ Linha Própria ════════════════════════════════

export const fornecedorSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  razao_social: optionalText,
  cnpj: optionalText,
  telefone: optionalText,
  whatsapp: optionalText,
  email: optionalEmail,
  site: optionalText,
  cep: optionalText,
  logradouro: optionalText,
  numero: optionalText,
  complemento: optionalText,
  bairro: optionalText,
  cidade: optionalText,
  estado: optionalText,
  observacoes: optionalText,
  ativo: z.boolean().default(true),
});

export const produtoProprioSchema = z.object({
  sku: z.string().trim().min(1, "Informe o SKU"),
  nome: z.string().trim().min(2, "Informe o nome"),
  descricao: optionalText,
  fornecedor_id: optionalText,
  ncm: optionalText,
  ean: optionalText,
  unidade: optionalText,
  imagem_url: optionalText,
  custo: optionalNumber,
  preco_bruto: optionalNumber, // preço de venda ao seller
  estoque_minimo: optionalNumber,
  peso: optionalNumber,
  altura: optionalNumber,
  largura: optionalNumber,
  comprimento: optionalNumber,
  ativo: z.boolean().default(true),
  observacoes: optionalText,
});

export const compraItemSchema = z.object({
  produto_id: z.string().uuid("Selecione o produto"),
  quantidade: z.coerce.number().int().positive("Qtd inválida"),
  custo_unitario: z.coerce.number().nonnegative(),
});

export const compraSchema = z.object({
  fornecedor_id: optionalText,
  numero_nota: optionalText,
  data_compra: optionalText,
  frete: optionalNumber,
  outras_despesas: optionalNumber,
  observacoes: optionalText,
  itens: z.array(compraItemSchema).min(1, "Adicione ao menos um item"),
});

export const ajusteEstoqueSchema = z.object({
  produto_id: z.string().uuid(),
  novo_saldo: z.coerce.number().int().min(0, "Saldo inválido"),
  motivo: z.string().trim().min(2, "Informe o motivo"),
});

export const pedidoDropItemSchema = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.coerce.number().int().positive(),
  preco_venda: z.coerce.number().nonnegative(),
});

export const pedidoDropSchema = z.object({
  cliente_id: z.string().uuid("Selecione o seller"),
  canal: optionalText,
  pedido_externo: optionalText,
  entrega_nome: optionalText,
  entrega_documento: optionalText,
  entrega_telefone: optionalText,
  entrega_cep: optionalText,
  entrega_logradouro: optionalText,
  entrega_numero: optionalText,
  entrega_complemento: optionalText,
  entrega_bairro: optionalText,
  entrega_cidade: optionalText,
  entrega_uf: optionalText,
  observacao_interna: optionalText,
  frete: optionalNumber,
  itens: z.array(pedidoDropItemSchema).min(1, "Adicione ao menos um produto"),
});

export const contaReceberSchema = z.object({
  cliente_id: optionalText,
  pedido_id: optionalText,
  descricao: z.string().trim().min(2, "Informe a descrição"),
  valor: z.coerce.number().positive("Valor inválido"),
  vencimento: optionalText,
  forma: optionalText,
  observacoes: optionalText,
});

export const marcarPagoSchema = z.object({
  id: z.string().uuid(),
  valor_pago: optionalNumber,
  pago_em: optionalText,
  forma: optionalText,
});
