// Tipos das entidades do schema `comercial` (espelham as migrations 008..013).

export interface Representada {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
  contato_comercial: string | null;
  contato_financeiro: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  pedido_minimo: number | null;
  percentual_comissao_padrao: number | null;
  desconto_maximo_padrao: number | null;
  prazo_pagamento_padrao: string | null;
  prazo_entrega: string | null;
  logo_url: string | null;
  observacoes: string | null;
  modalidades: string[];
  dropship_faturamento: string | null;
  dropship_condicoes_pagamento: string[];
  dropship_observacoes: string | null;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

export const MODALIDADE_OPTIONS = [
  { value: "atacado", label: "Atacado" },
  { value: "dropshipping", label: "Dropshipping" },
] as const;

export const DROPSHIP_FATURAMENTO_OPTIONS = [
  "Diário",
  "Semanal",
  "Quinzenal",
  "Mensal",
] as const;

export const DROPSHIP_PAGAMENTO_OPTIONS = ["Pix", "Boleto", "Semanal", "À vista"] as const;

export interface CategoriaProduto {
  id: string;
  representada_id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  created_at: string;
}

export interface Produto {
  id: string;
  representada_id: string;
  categoria_id: string | null;
  sku: string;
  codigo_fabrica: string | null;
  ean: string | null;
  ncm: string | null;
  nome: string;
  descricao: string | null;
  marca: string | null;
  aplicacao: string | null;
  montadora: string | null;
  modelo: string | null;
  ano_inicio: number | null;
  ano_fim: number | null;
  unidade: string | null;
  peso: number | null;
  preco_bruto: number | null;
  altura: number | null;
  largura: number | null;
  comprimento: number | null;
  imagem_url: string | null;
  ativo: boolean;
  observacoes: string | null;
  tem_variacoes: boolean;
  variacao_eixos: VariacaoEixo[];
  created_at: string;
  updated_at: string;
}

/** Um eixo de variação de um produto (ex.: "Estofado" → ["Couro","Tecido"]). */
export interface VariacaoEixo {
  nome: string;
  valores: string[];
}

export interface ProdutoVariacao {
  id: string;
  produto_id: string;
  sku: string;
  /** { "Estofado": "Couro", "Costura": "Dupla vermelha" } */
  atributos: Record<string, string>;
  /** nulo = herda o preço bruto do produto pai */
  preco_bruto: number | null;
  codigo_fabrica: string | null;
  ean: string | null;
  imagem_url: string | null;
  peso: number | null;
  ativo: boolean;
  ordem: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TabelaPreco {
  id: string;
  representada_id: string;
  nome: string;
  descricao: string | null;
  tipo: string | null;
  desconto_percentual: number;
  data_inicio: string | null;
  data_fim: string | null;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProdutoPreco {
  id: string;
  produto_id: string;
  tabela_preco_id: string;
  preco: number;
  preco_minimo: number | null;
  desconto_maximo: number | null;
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id: string;
  tipo_pessoa: "juridica" | "fisica";
  cnpj: string | null;
  cpf: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  inscricao_estadual: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  vendedor_id: string | null;
  limite_credito: number | null;
  status: "prospect" | "ativo" | "inativo" | "bloqueado" | "reativacao";
  data_ultima_compra: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClienteContato {
  id: string;
  cliente_id: string;
  nome: string;
  cargo: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  principal: boolean;
  created_at: string;
}

export interface ClienteRepresentada {
  id: string;
  cliente_id: string;
  representada_id: string;
  tabela_preco_id: string | null;
  condicao_pagamento: string | null;
  desconto_padrao: number | null;
  limite_credito: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pedido {
  id: string;
  numero: number;
  share_token: string;
  cliente_id: string;
  representada_id: string;
  tabela_preco_id: string | null;
  vendedor_id: string | null;
  data_pedido: string;
  status: string;
  subtotal: number;
  desconto_percentual: number;
  desconto_valor: number;
  valor_total: number;
  condicao_pagamento: string | null;
  forma_pagamento: string | null;
  previsao_entrega: string | null;
  observacao_cliente: string | null;
  observacao_representada: string | null;
  observacao_interna: string | null;
  numero_pedido_fabrica: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PedidoItem {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  variacao_id: string | null;
  sku_snapshot: string | null;
  descricao_snapshot: string | null;
  quantidade: number;
  preco_tabela: number;
  desconto_item_percentual: number;
  desconto_item_valor: number;
  preco_unitario_final: number;
  valor_total: number;
  created_at: string;
}

export const CLIENTE_STATUS_OPTIONS = [
  { value: "prospect", label: "Prospect" },
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
  { value: "bloqueado", label: "Bloqueado" },
  { value: "reativacao", label: "Reativação" },
] as const;

export const PEDIDO_STATUS_OPTIONS = [
  { value: "orcamento", label: "Orçamento" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { value: "enviado", label: "Enviado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "faturado", label: "Faturado" },
  { value: "em_transporte", label: "Em transporte" },
  { value: "entregue", label: "Entregue" },
  { value: "pendencia", label: "Pendência" },
  { value: "cancelado", label: "Cancelado" },
  { value: "rejeitado", label: "Rejeitado" },
] as const;

/** status que contam como venda realizada (para métricas de "vendido") */
export const STATUS_VENDA = [
  "confirmado",
  "faturado",
  "em_transporte",
  "entregue",
  "pendencia",
] as const;

export const CONDICAO_PAGAMENTO_OPTIONS = [
  "À vista",
  "PIX",
  "Boleto 7 dias",
  "Boleto 14 dias",
  "Boleto 21/28 dias",
  "28/35/42 dias",
  "30/60/90 dias",
] as const;

export const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

export type ActionResult<T = { id?: string }> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export const TIPO_TABELA_OPTIONS = [
  "Loja",
  "Distribuidor",
  "Seller",
  "Especial",
  "Promocional",
] as const;

export const UNIDADE_OPTIONS = ["UN", "PC", "CX", "KG", "MT", "PAR", "JG", "L"] as const;

// ──────────────────────────────── Tarefas ──────────────────────────────────
export const TAREFA_TIPO_OPTIONS = [
  { value: "ligacao", label: "Ligação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "visita", label: "Visita" },
  { value: "reuniao", label: "Reunião" },
  { value: "followup", label: "Follow-up" },
  { value: "outro", label: "Outro" },
] as const;

export const TAREFA_PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
] as const;

export const TAREFA_STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
] as const;

// ───────────────────────────── CRM / Oportunidades ─────────────────────────
export const CRM_ETAPA_OPTIONS = [
  { value: "prospect", label: "Prospect" },
  { value: "primeiro_contato", label: "Primeiro contato" },
  { value: "apresentacao", label: "Apresentação" },
  { value: "tabela_enviada", label: "Tabela enviada" },
  { value: "negociacao", label: "Negociação" },
  { value: "primeiro_pedido", label: "Primeiro pedido" },
  { value: "cliente_ativo", label: "Cliente ativo" },
  { value: "perdido", label: "Perdido" },
] as const;
