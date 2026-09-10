// Cálculo de pedido — puro, usado no cliente (preview) e no servidor (gravação).

export interface CalcItemInput {
  quantidade: number;
  preco_tabela: number;
  desconto_item_percentual: number;
  /** Descontos sucessivos, em %. Ex.: [50, 6.66, 4]. Tem prioridade sobre desconto_item_percentual. */
  desconto_cascata?: number[] | null;
  /** Preço unitário final digitado à mão. Quando > 0, ignora descontos. */
  preco_liquido_manual?: number | null;
}

export interface CalcItemResult extends CalcItemInput {
  desconto_cascata: number[];
  preco_liquido_manual: number | null;
  preco_unitario_final: number;
  desconto_item_valor: number;
  valor_total: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Normaliza uma cadeia de descontos: números entre 0 e 100, descarta vazios/zeros. */
export function normalizarCascata(c?: number[] | null): number[] {
  return (Array.isArray(c) ? c : [])
    .map((n) => Number(n) || 0)
    .map((n) => Math.min(Math.max(n, 0), 100))
    .filter((n) => n > 0);
}

/** Converte campos de texto ("50", "6,66", "") numa cadeia limpa de números. */
export function parseCascata(campos: (string | number)[] | string): number[] {
  const arr = Array.isArray(campos)
    ? campos
    : String(campos).split(/[+xX;·\s]+/);
  return normalizarCascata(
    arr.map((v) => (typeof v === "number" ? v : Number(String(v).replace(",", ".").trim())))
  );
}

/** Aplica descontos sucessivos (um sobre o outro). Arredonda só no fim. */
export function aplicarCascata(base: number, cascata: number[]): number {
  const b = Number(base) || 0;
  let fator = 1;
  for (const d of normalizarCascata(cascata)) fator *= 1 - d / 100;
  return round2(b * fator);
}

/** Percentual efetivo de uma cadeia: [50, 6.66, 4] => 55,2 (2 casas). */
export function cascataEfetiva(cascata: number[]): number {
  let fator = 1;
  for (const d of normalizarCascata(cascata)) fator *= 1 - d / 100;
  return round2((1 - fator) * 100);
}

export function calcItem(item: CalcItemInput): CalcItemResult {
  const qtd = Number(item.quantidade) || 0;
  const base = Number(item.preco_tabela) || 0;
  const manual =
    item.preco_liquido_manual != null && Number(item.preco_liquido_manual) >= 0
      ? round2(Number(item.preco_liquido_manual))
      : null;
  let cascata = normalizarCascata(item.desconto_cascata);

  let pct: number;
  let unitFinal: number;
  if (manual != null) {
    cascata = [];
    unitFinal = manual;
    pct = base > 0 ? round2((1 - unitFinal / base) * 100) : 0;
  } else if (cascata.length > 0) {
    unitFinal = aplicarCascata(base, cascata);
    pct = base > 0 ? round2((1 - unitFinal / base) * 100) : cascataEfetiva(cascata);
  } else {
    pct = Math.min(Math.max(Number(item.desconto_item_percentual) || 0, 0), 100);
    unitFinal = round2(base * (1 - pct / 100));
  }

  const descValorUnit = round2(base - unitFinal);
  return {
    quantidade: qtd,
    preco_tabela: base,
    desconto_item_percentual: pct,
    desconto_cascata: cascata,
    preco_liquido_manual: manual,
    preco_unitario_final: unitFinal,
    desconto_item_valor: round2(descValorUnit * qtd),
    valor_total: round2(unitFinal * qtd),
  };
}

export interface CalcPedidoInput {
  itens: CalcItemInput[];
  desconto_modo: "percentual" | "valor";
  desconto_input: number;
  /** Cascata sobre o subtotal. Tem prioridade sobre desconto_modo/desconto_input. */
  desconto_cascata?: number[] | null;
}

export interface CalcPedidoResult {
  itens: CalcItemResult[];
  subtotal: number;
  desconto_percentual: number;
  desconto_valor: number;
  desconto_cascata: number[];
  valor_total: number;
}

export function calcPedido(input: CalcPedidoInput): CalcPedidoResult {
  const itens = input.itens.map(calcItem);
  const subtotal = round2(itens.reduce((s, i) => s + i.valor_total, 0));

  const cascata = normalizarCascata(input.desconto_cascata);
  let descValor = 0;
  let descPct = 0;

  if (cascata.length > 0) {
    const aposCascata = aplicarCascata(subtotal, cascata);
    descValor = round2(subtotal - aposCascata);
    descPct = subtotal > 0 ? round2((descValor / subtotal) * 100) : cascataEfetiva(cascata);
  } else if (input.desconto_modo === "percentual") {
    descPct = Math.min(Math.max(Number(input.desconto_input) || 0, 0), 100);
    descValor = round2(subtotal * (descPct / 100));
  } else {
    descValor = Math.min(Math.max(Number(input.desconto_input) || 0, 0), subtotal);
    descPct = subtotal > 0 ? round2((descValor / subtotal) * 100) : 0;
  }

  return {
    itens,
    subtotal,
    desconto_percentual: descPct,
    desconto_valor: descValor,
    desconto_cascata: cascata,
    valor_total: round2(subtotal - descValor),
  };
}
