// Cálculo de pedido — puro, usado no cliente (preview) e no servidor (gravação).

export interface CalcItemInput {
  quantidade: number;
  preco_tabela: number;
  desconto_item_percentual: number;
}

export interface CalcItemResult extends CalcItemInput {
  preco_unitario_final: number;
  desconto_item_valor: number;
  valor_total: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcItem(item: CalcItemInput): CalcItemResult {
  const qtd = Number(item.quantidade) || 0;
  const base = Number(item.preco_tabela) || 0;
  const pct = Math.min(Math.max(Number(item.desconto_item_percentual) || 0, 0), 100);
  const unitFinal = round2(base * (1 - pct / 100));
  const descValorUnit = round2(base - unitFinal);
  return {
    quantidade: qtd,
    preco_tabela: base,
    desconto_item_percentual: pct,
    preco_unitario_final: unitFinal,
    desconto_item_valor: round2(descValorUnit * qtd),
    valor_total: round2(unitFinal * qtd),
  };
}

export interface CalcPedidoInput {
  itens: CalcItemInput[];
  desconto_modo: "percentual" | "valor";
  desconto_input: number;
}

export interface CalcPedidoResult {
  itens: CalcItemResult[];
  subtotal: number;
  desconto_percentual: number;
  desconto_valor: number;
  valor_total: number;
}

export function calcPedido(input: CalcPedidoInput): CalcPedidoResult {
  const itens = input.itens.map(calcItem);
  const subtotal = round2(itens.reduce((s, i) => s + i.valor_total, 0));

  let descValor = 0;
  let descPct = 0;
  if (input.desconto_modo === "percentual") {
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
    valor_total: round2(subtotal - descValor),
  };
}
