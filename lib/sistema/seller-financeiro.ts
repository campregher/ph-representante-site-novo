import { createSistemaAdminClient } from "@/lib/supabase/server";
import { STATUS_VENDA } from "@/lib/sistema/types";

export interface VendaSellerRow {
  pedidoId: string;
  numero: number;
  data: string;
  produtos: string;
  quantidade: number;
  venda: number;
  comissaoMl: number;
  frete: number;
  custo: number;
  lucro: number;
  lucroPercentual: number;
}

export interface CardPeriodo {
  valor: number;
  quantidade: number;
}

export interface FinanceiroSeller {
  hoje: CardPeriodo;
  semana: CardPeriodo;
  mes: CardPeriodo;
  vendas: VendaSellerRow[];
}

/** Financeiro do seller (D7): vendas via ML (linha própria, canal=Mercado
 *  Livre) com venda/comissão/frete/custo/lucro por pedido + cards de
 *  dia/semana/mês (valor vendido + quantidade de produtos). */
export async function getFinanceiroSeller(clienteId: string): Promise<FinanceiroSeller> {
  const db = await createSistemaAdminClient();
  const desde = new Date();
  desde.setDate(desde.getDate() - 31);

  const { data } = await db
    .from("pedidos")
    .select(
      "id, numero, data_pedido, status, ml_frete, pedido_itens(descricao_snapshot, quantidade, ml_preco_venda, ml_comissao, custo_unitario)"
    )
    .eq("cliente_id", clienteId)
    .eq("tipo", "drop_proprio")
    .eq("canal", "Mercado Livre")
    .gte("data_pedido", desde.toISOString())
    .order("data_pedido", { ascending: false })
    .limit(500);

  type Row = {
    id: string;
    numero: number;
    data_pedido: string;
    status: string;
    ml_frete: number | null;
    pedido_itens: {
      descricao_snapshot: string | null;
      quantidade: number;
      ml_preco_venda: number | null;
      ml_comissao: number | null;
      custo_unitario: number | null;
    }[];
  };

  const rows = ((data ?? []) as unknown as Row[]).filter((r) =>
    (STATUS_VENDA as readonly string[]).includes(r.status)
  );

  const vendas: VendaSellerRow[] = rows.map((r) => {
    const itens = r.pedido_itens ?? [];
    const quantidade = itens.reduce((s, it) => s + Number(it.quantidade), 0);
    const venda = itens.reduce((s, it) => s + Number(it.ml_preco_venda ?? 0) * Number(it.quantidade), 0);
    const comissaoMl = itens.reduce((s, it) => s + Number(it.ml_comissao ?? 0), 0);
    const custo = itens.reduce((s, it) => s + Number(it.custo_unitario ?? 0) * Number(it.quantidade), 0);
    const frete = Number(r.ml_frete ?? 0);
    const lucro = Math.round((venda - comissaoMl - frete - custo) * 100) / 100;
    return {
      pedidoId: r.id,
      numero: r.numero,
      data: r.data_pedido,
      produtos: itens.map((it) => it.descricao_snapshot).filter(Boolean).join(", ") || "—",
      quantidade,
      venda: Math.round(venda * 100) / 100,
      comissaoMl: Math.round(comissaoMl * 100) / 100,
      frete: Math.round(frete * 100) / 100,
      custo: Math.round(custo * 100) / 100,
      lucro,
      lucroPercentual: venda > 0 ? Math.round((lucro / venda) * 1000) / 10 : 0,
    };
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay());
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const somaPeriodo = (desde: Date): CardPeriodo =>
    vendas
      .filter((v) => new Date(v.data) >= desde)
      .reduce((acc, v) => ({ valor: acc.valor + v.venda, quantidade: acc.quantidade + v.quantidade }), {
        valor: 0,
        quantidade: 0,
      });

  return {
    hoje: somaPeriodo(hoje),
    semana: somaPeriodo(inicioSemana),
    mes: somaPeriodo(inicioMes),
    vendas,
  };
}
