"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { canFinance } from "@/lib/sistema/roles";
import { aplicarMovimento } from "@/lib/sistema/estoque-mov";
import { pedidoDropSchema } from "@/lib/sistema/schemas";
import type { ActionResult } from "@/lib/sistema/types";

async function guard() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (profile.role === "consulta")
    return { profile: null, error: "Seu papel é somente leitura." as const };
  return { profile, error: null };
}

const TERMINAIS = ["faturado", "em_transporte", "entregue", "cancelado", "rejeitado"];

export async function salvarPedidoDrop(
  id: string | null,
  raw: unknown
): Promise<ActionResult<{ id?: string; numero?: number }>> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const parsed = pedidoDropSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const v = parsed.data;
  const supabase = await createSistemaClient();

  const ids = v.itens.map((i) => i.produto_id);
  const { data: prods } = await supabase
    .from("produtos")
    .select("id, sku, nome, custo, linha_propria")
    .in("id", ids);
  const pmap = new Map((prods ?? []).map((p) => [p.id as string, p]));
  for (const it of v.itens) {
    const p = pmap.get(it.produto_id);
    if (!p || !p.linha_propria)
      return { ok: false, error: "Só produtos da linha própria podem entrar no pedido drop." };
  }

  const frete = Number(v.frete ?? 0);
  const subtotal = v.itens.reduce((s, it) => s + it.quantidade * it.preco_venda, 0);
  const valorTotal = Math.round((subtotal + frete) * 100) / 100;

  const header = {
    cliente_id: v.cliente_id,
    representada_id: null,
    tabela_preco_id: null,
    tipo: "drop_proprio",
    canal: v.canal,
    pedido_externo: v.pedido_externo,
    entrega_nome: v.entrega_nome,
    entrega_documento: v.entrega_documento,
    entrega_telefone: v.entrega_telefone,
    entrega_cep: v.entrega_cep,
    entrega_logradouro: v.entrega_logradouro,
    entrega_numero: v.entrega_numero,
    entrega_complemento: v.entrega_complemento,
    entrega_bairro: v.entrega_bairro,
    entrega_cidade: v.entrega_cidade,
    entrega_uf: v.entrega_uf,
    observacao_interna: v.observacao_interna,
    subtotal: Math.round(subtotal * 100) / 100,
    desconto_valor: 0,
    desconto_percentual: 0,
    valor_total: valorTotal,
    updated_by: g.profile!.id,
  };

  const itensRows = v.itens.map((it) => {
    const p = pmap.get(it.produto_id)!;
    return {
      produto_id: it.produto_id,
      sku_snapshot: p.sku as string,
      descricao_snapshot: p.nome as string,
      quantidade: it.quantidade,
      preco_tabela: it.preco_venda,
      desconto_item_percentual: 0,
      desconto_item_valor: 0,
      preco_unitario_final: it.preco_venda,
      valor_total: Math.round(it.quantidade * it.preco_venda * 100) / 100,
      custo_unitario: Number(p.custo ?? 0),
    };
  });

  if (id) {
    const { data: atual } = await supabase.from("pedidos").select("status, tipo").eq("id", id).maybeSingle();
    if (!atual) return { ok: false, error: "Pedido não encontrado." };
    if (TERMINAIS.includes(atual.status as string))
      return { ok: false, error: "Este pedido não pode mais ser editado." };
    const { error: e1 } = await supabase.from("pedidos").update(header).eq("id", id);
    if (e1) return { ok: false, error: e1.message };
    await supabase.from("pedido_itens").delete().eq("pedido_id", id);
    const { error: e2 } = await supabase
      .from("pedido_itens")
      .insert(itensRows.map((r) => ({ ...r, pedido_id: id })));
    if (e2) return { ok: false, error: e2.message };
    revalidatePath("/sistema/pedidos");
    revalidatePath(`/sistema/pedidos/${id}`);
    return { ok: true, id };
  }

  const { data: novo, error } = await supabase
    .from("pedidos")
    .insert({ ...header, status: "orcamento", created_by: g.profile!.id })
    .select("id, numero")
    .single();
  if (error) return { ok: false, error: error.message };
  const { error: eItens } = await supabase
    .from("pedido_itens")
    .insert(itensRows.map((r) => ({ ...r, pedido_id: novo.id as string })));
  if (eItens) {
    await supabase.from("pedidos").delete().eq("id", novo.id as string);
    return { ok: false, error: `Falha ao gravar itens: ${eItens.message}` };
  }
  revalidatePath("/sistema/pedidos");
  return { ok: true, id: novo.id as string, numero: novo.numero as number };
}

/** Confirma o pedido drop e baixa o estoque (valida saldo). */
export async function confirmarPedidoDrop(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();

  const { data: ped } = await supabase
    .from("pedidos")
    .select("status, tipo, numero")
    .eq("id", id)
    .maybeSingle();
  if (!ped || ped.tipo !== "drop_proprio") return { ok: false, error: "Pedido drop não encontrado." };
  if (!["orcamento", "aguardando_aprovacao"].includes(ped.status as string))
    return { ok: false, error: "Pedido já confirmado." };

  const { data: itens } = await supabase
    .from("pedido_itens")
    .select("produto_id, quantidade, descricao_snapshot")
    .eq("pedido_id", id);

  // valida saldo
  const faltas: string[] = [];
  for (const it of itens ?? []) {
    if (!it.produto_id) continue;
    const { data: p } = await supabase
      .from("produtos")
      .select("estoque_atual, nome")
      .eq("id", it.produto_id as string)
      .maybeSingle();
    const saldo = Number(p?.estoque_atual ?? 0);
    if (saldo < Number(it.quantidade))
      faltas.push(`${p?.nome ?? it.descricao_snapshot}: precisa ${it.quantidade}, tem ${saldo}`);
  }
  if (faltas.length) return { ok: false, error: "Estoque insuficiente — " + faltas.join(" | ") };

  for (const it of itens ?? []) {
    if (!it.produto_id) continue;
    await aplicarMovimento(supabase, {
      produtoId: it.produto_id as string,
      delta: -Number(it.quantidade),
      tipo: "saida",
      origemTipo: "pedido",
      origemId: id,
      observacao: `Pedido drop #${ped.numero}`,
      userId: g.profile!.id,
    });
  }
  await supabase.from("pedidos").update({ status: "confirmado", updated_by: g.profile!.id }).eq("id", id);
  await supabase.from("pedido_historico").insert({
    pedido_id: id,
    status_novo: "confirmado",
    descricao: "Pedido drop confirmado — estoque baixado",
    usuario_id: g.profile!.id,
  });
  revalidatePath("/sistema/pedidos");
  revalidatePath(`/sistema/pedidos/${id}`);
  revalidatePath("/sistema/estoque");
  return { ok: true, id };
}

/** Fatura o pedido drop e gera a conta a receber. */
export async function faturarPedidoDrop(
  id: string,
  input: { numero_nf?: string; vencimento?: string; forma?: string }
): Promise<ActionResult> {
  const profile = await getSistemaProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };
  if (!canFinance(profile.role))
    return { ok: false, error: "Apenas Financeiro/Gerente/Admin podem faturar." };
  const supabase = await createSistemaClient();

  const { data: ped } = await supabase
    .from("pedidos")
    .select("status, tipo, numero, cliente_id, valor_total")
    .eq("id", id)
    .maybeSingle();
  if (!ped || ped.tipo !== "drop_proprio") return { ok: false, error: "Pedido drop não encontrado." };
  if (ped.status !== "confirmado")
    return { ok: false, error: "Confirme o pedido antes de faturar." };

  await supabase.from("pedido_faturamento").insert({
    pedido_id: id,
    numero_nf: input.numero_nf || null,
    data_emissao: new Date().toISOString().slice(0, 10),
    valor_nf: ped.valor_total,
    valor_faturado: ped.valor_total,
  });
  await supabase.from("contas_receber").insert({
    pedido_id: id,
    cliente_id: ped.cliente_id,
    descricao: `Pedido drop #${ped.numero}` + (input.numero_nf ? ` — NF ${input.numero_nf}` : ""),
    valor: ped.valor_total,
    vencimento: input.vencimento || null,
    forma: input.forma || null,
    status: "aberto",
    created_by: profile.id,
  });
  await supabase.from("pedidos").update({ status: "faturado", updated_by: profile.id }).eq("id", id);
  await supabase.from("pedido_historico").insert({
    pedido_id: id,
    status_novo: "faturado",
    descricao: "Pedido faturado — conta a receber gerada",
    usuario_id: profile.id,
  });
  revalidatePath("/sistema/pedidos");
  revalidatePath(`/sistema/pedidos/${id}`);
  revalidatePath("/sistema/cobranca");
  return { ok: true, id };
}

/** Cancela o pedido drop, estornando estoque e contas em aberto. */
export async function cancelarPedidoDrop(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { data: ped } = await supabase
    .from("pedidos")
    .select("status, tipo, numero")
    .eq("id", id)
    .maybeSingle();
  if (!ped || ped.tipo !== "drop_proprio") return { ok: false, error: "Pedido drop não encontrado." };
  if (ped.status === "cancelado") return { ok: true };

  if (["confirmado", "faturado", "em_transporte", "entregue"].includes(ped.status as string)) {
    const { data: itens } = await supabase
      .from("pedido_itens")
      .select("produto_id, quantidade")
      .eq("pedido_id", id);
    for (const it of itens ?? []) {
      if (!it.produto_id) continue;
      await aplicarMovimento(supabase, {
        produtoId: it.produto_id as string,
        delta: Number(it.quantidade),
        tipo: "ajuste",
        origemTipo: "pedido",
        origemId: id,
        observacao: `Estorno do pedido drop #${ped.numero} cancelado`,
        userId: g.profile!.id,
      });
    }
  }
  await supabase
    .from("contas_receber")
    .update({ status: "cancelado" })
    .eq("pedido_id", id)
    .eq("status", "aberto");
  await supabase.from("pedidos").update({ status: "cancelado", updated_by: g.profile!.id }).eq("id", id);
  revalidatePath("/sistema/pedidos");
  revalidatePath("/sistema/estoque");
  revalidatePath("/sistema/cobranca");
  return { ok: true };
}
