// Cálculo de pedido — puro, usado no cliente (preview) e no servidor (gravação).

export interface CalcItemInput {
  quantidade: number;
  preco_tabela: number;
  desconto_item_percentual: number;
  /** Descontos sucessivos, em %. Ex.: [50, 6.66, 4]. Aplicados antes dos acréscimos. */
  desconto_cascata?: number[] | null;
  /** Acréscimos sucessivos, em %. Ex.: [5]. Aplicados depois dos descontos. */
  acrescimo_cascata?: number[] | null;
  /** Preço unitário final digitado à mão. Quando informado, ignora desconto/acréscimo. */
  preco_liquido_manual?: number | null;
}

export interface CalcItemResult extends CalcItemInput {
  desconto_cascata: number[];
  acrescimo_cascata: number[];
  preco_liquido_manual: number | null;
  preco_unitario_final: number;
  desconto_item_valor: number;
  valor_total: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e3) / 1e3;
}
/** Preço unitário mantém precisão (igual Mercos: mostra 171,51225). */
function round5(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e5) / 1e5;
}

/** Normaliza uma cadeia de percentuais: entre 0 e `max`, descarta vazios/zeros. */
export function normalizarLista(c: number[] | null | undefined, max = 100): number[] {
  return (Array.isArray(c) ? c : [])
    .map((n) => Number(n) || 0)
    .map((n) => Math.min(Math.max(n, 0), max))
    .filter((n) => n > 0);
}
export const normalizarCascata = (c?: number[] | null): number[] => normalizarLista(c, 100);

/** Converte campos de texto ("50", "6,66", "") numa cadeia limpa de números. */
export function parseCascata(campos: (string | number)[] | string, max = 100): number[] {
  const arr = Array.isArray(campos) ? campos : String(campos).split(/[+xX;·\s]+/);
  return normalizarLista(
    arr.map((v) => (typeof v === "number" ? v : Number(String(v).replace(",", ".").trim()))),
    max
  );
}

/** Aplica descontos e depois acréscimos, um sobre o outro. Arredonda só no fim. */
export function aplicarDescAcresc(
  base: number,
  descontos: number[],
  acrescimos: number[] = []
): number {
  const b = Number(base) || 0;
  let fator = 1;
  for (const d of normalizarLista(descontos, 100)) fator *= 1 - d / 100;
  for (const a of normalizarLista(acrescimos, 1000)) fator *= 1 + a / 100;
  return round5(b * fator);
}

/** Só descontos (compat.) */
export function aplicarCascata(base: number, cascata: number[]): number {
  return aplicarDescAcresc(base, cascata, []);
}

/** Percentual efetivo de uma cadeia de descontos: [50, 6.66, 4] => 55,2. */
export function cascataEfetiva(cascata: number[]): number {
  let fator = 1;
  for (const d of normalizarLista(cascata, 100)) fator *= 1 - d / 100;
  return round2((1 - fator) * 100);
}

export function calcItem(item: CalcItemInput): CalcItemResult {
  const qtd = Number(item.quantidade) || 0;
  const base = Number(item.preco_tabela) || 0;
  const manual =
    item.preco_liquido_manual != null && Number(item.preco_liquido_manual) >= 0
      ? round5(Number(item.preco_liquido_manual))
      : null;

  let desc = normalizarLista(item.desconto_cascata, 100);
  let acr = normalizarLista(item.acrescimo_cascata, 1000);

  let pct: number;
  let unitFinal: number;
  if (manual != null) {
    desc = [];
    acr = [];
    unitFinal = manual;
    pct = base > 0 ? round3((1 - unitFinal / base) * 100) : 0;
  } else if (desc.length > 0 || acr.length > 0) {
    unitFinal = aplicarDescAcresc(base, desc, acr);
    pct = base > 0 ? round3((1 - unitFinal / base) * 100) : 0;
  } else {
    pct = Math.min(Math.max(Number(item.desconto_item_percentual) || 0, 0), 100);
    unitFinal = round5(base * (1 - pct / 100));
  }

  return {
    quantidade: qtd,
    preco_tabela: base,
    desconto_item_percentual: pct,
    desconto_cascata: desc,
    acrescimo_cascata: acr,
    preco_liquido_manual: manual,
    preco_unitario_final: unitFinal,
    desconto_item_valor: round2((base - unitFinal) * qtd),
    valor_total: round2(unitFinal * qtd),
  };
}

export interface CalcPedidoInput {
  itens: CalcItemInput[];
  desconto_modo: "percentual" | "valor";
  desconto_input: number;
  /** Cascata de desconto sobre o subtotal. Tem prioridade sobre desconto_modo/desconto_input. */
  desconto_cascata?: number[] | null;
}

export interface CalcPedidoResult {
  itens: CalcItemResult[];
  subtotal: number;
  /** subtotal dos itens SEM desconto de item (preço de tabela × qtd). */
  subtotal_bruto: number;
  /** desconto médio ponderado do pedido inteiro, em %. */
  desconto_medio: number;
  desconto_percentual: number;
  desconto_valor: number;
  desconto_cascata: number[];
  valor_total: number;
}

export function calcPedido(input: CalcPedidoInput): CalcPedidoResult {
  const itens = input.itens.map(calcItem);
  const subtotal = round2(itens.reduce((s, i) => s + i.valor_total, 0));
  const subtotalBruto = round2(itens.reduce((s, i) => s + i.preco_tabela * i.quantidade, 0));
  // versões sem arredondar por linha — para o "desconto médio" bater com o Mercos
  const brutoPreciso = itens.reduce((s, i) => s + i.preco_tabela * i.quantidade, 0);
  const liqPreciso = itens.reduce((s, i) => s + i.preco_unitario_final * i.quantidade, 0);

  const cascata = normalizarLista(input.desconto_cascata, 100);
  let descValor = 0;
  let descPct = 0;

  if (cascata.length > 0) {
    const aposCascata = aplicarDescAcresc(subtotal, cascata, []);
    descValor = round2(subtotal - aposCascata);
    descPct = subtotal > 0 ? round2((descValor / subtotal) * 100) : cascataEfetiva(cascata);
  } else if (input.desconto_modo === "percentual") {
    descPct = Math.min(Math.max(Number(input.desconto_input) || 0, 0), 100);
    descValor = round2(subtotal * (descPct / 100));
  } else {
    descValor = Math.min(Math.max(Number(input.desconto_input) || 0, 0), subtotal);
    descPct = subtotal > 0 ? round2((descValor / subtotal) * 100) : 0;
  }

  const valorTotal = round2(subtotal - descValor);
  const descontoMedio =
    brutoPreciso > 0
      ? Math.round(((brutoPreciso - liqPreciso + descValor) / brutoPreciso) * 1e6) / 1e4
      : 0;

  return {
    itens,
    subtotal,
    subtotal_bruto: subtotalBruto,
    desconto_medio: descontoMedio,
    desconto_percentual: descPct,
    desconto_valor: descValor,
    desconto_cascata: cascata,
    valor_total: valorTotal,
  };
}
