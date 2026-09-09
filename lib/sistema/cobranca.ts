import { createSistemaClient } from "@/lib/supabase/server";

export interface ContaRow {
  id: string;
  descricao: string;
  cliente: string | null;
  pedido_numero: number | null;
  valor: number;
  vencimento: string | null;
  forma: string | null;
  status: string; // aberto | pago | vencido | cancelado (vencido é derivado)
  valor_pago: number | null;
  pago_em: string | null;
}

const hoje = () => new Date().toISOString().slice(0, 10);

export async function listContasReceber(opts: {
  status?: string;
  clienteId?: string;
}): Promise<ContaRow[]> {
  const supabase = await createSistemaClient();
  let q = supabase
    .from("contas_receber")
    .select(
      "id, descricao, valor, vencimento, forma, status, valor_pago, pago_em, cliente:clientes(nome_fantasia, razao_social), pedido:pedidos(numero)"
    )
    .order("vencimento", { ascending: true, nullsFirst: false })
    .limit(500);
  if (opts.clienteId) q = q.eq("cliente_id", opts.clienteId);
  if (opts.status && opts.status !== "vencido") q = q.eq("status", opts.status);
  const { data } = await q;
  const h = hoje();
  let rows = ((data ?? []) as unknown as {
    id: string;
    descricao: string;
    valor: number;
    vencimento: string | null;
    forma: string | null;
    status: string;
    valor_pago: number | null;
    pago_em: string | null;
    cliente: { nome_fantasia: string | null; razao_social: string | null } | null;
    pedido: { numero: number } | null;
  }[]).map((c) => ({
    id: c.id,
    descricao: c.descricao,
    cliente: c.cliente ? c.cliente.nome_fantasia || c.cliente.razao_social : null,
    pedido_numero: c.pedido?.numero ?? null,
    valor: Number(c.valor),
    vencimento: c.vencimento,
    forma: c.forma,
    status:
      c.status === "aberto" && c.vencimento && c.vencimento < h ? "vencido" : c.status,
    valor_pago: c.valor_pago != null ? Number(c.valor_pago) : null,
    pago_em: c.pago_em,
  }));
  if (opts.status === "vencido") rows = rows.filter((r) => r.status === "vencido");
  return rows;
}

export async function cobrancaKpis() {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("contas_receber")
    .select("valor, valor_pago, status, vencimento, pago_em")
    .limit(5000);
  const h = hoje();
  const mes = h.slice(0, 7);
  let aberto = 0,
    vencido = 0,
    pagoMes = 0,
    total = 0;
  for (const c of data ?? []) {
    const v = Number(c.valor);
    if (c.status === "aberto") {
      total += v;
      if (c.vencimento && c.vencimento < h) vencido += v;
      else aberto += v;
    } else if (c.status === "pago" && String(c.pago_em ?? "").slice(0, 7) === mes) {
      pagoMes += Number(c.valor_pago ?? c.valor);
    }
  }
  return { aberto, vencido, pagoMes, totalReceber: total };
}
