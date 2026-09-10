"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient, createSistemaAdminClient } from "@/lib/supabase/server";
import { getSistemaProfile, canManage } from "@/lib/sistema/auth";
import { pedidoSchema } from "@/lib/sistema/schemas";
import { calcPedido } from "@/lib/sistema/pedido-calc";
import { brutoEfetivo } from "@/lib/sistema/preco";
import { sincronizarComissaoPedido } from "@/lib/sistema/comissoes-sync";
import { criarNotificacao } from "@/lib/sistema/notificacoes";
import { PEDIDO_STATUS_OPTIONS } from "@/lib/sistema/types";
import type { ActionResult } from "@/lib/sistema/types";

const STATUS_LABEL = new Map<string, string>(
  PEDIDO_STATUS_OPTIONS.map((o) => [o.value, o.label])
);

async function guard() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (profile.role === "consulta")
    return { profile: null, error: "Seu papel é somente leitura." as const };
  return { profile, error: null };
}

interface SaveResult {
  id?: string;
  numero?: number;
  warning?: string;
}

export async function salvarPedido(
  id: string | null,
  raw: unknown
): Promise<ActionResult<SaveResult>> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };

  const parsed = pedidoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;
  const supabase = await createSistemaClient();

  // cliente
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, status, vendedor_id")
    .eq("id", v.cliente_id)
    .maybeSingle();
  if (!cliente) return { ok: false, error: "Cliente não encontrado." };
  if (cliente.status === "bloqueado")
    return { ok: false, error: "Cliente está bloqueado. Não é possível lançar pedido." };

  // representada
  const { data: rep } = await supabase
    .from("representadas")
    .select("id, ativa, pedido_minimo, desconto_maximo_padrao")
    .eq("id", v.representada_id)
    .maybeSingle();
  if (!rep) return { ok: false, error: "Representada não encontrada." };
  if (!rep.ativa) return { ok: false, error: "Representada inativa." };

  // tabelas usadas: a do pedido + as específicas de linha
  const tabelaIds = [
    ...new Set(
      [v.tabela_preco_id, ...v.itens.map((i) => i.tabela_preco_id)].filter(
        (x): x is string => !!x
      )
    ),
  ];
  const tabInfo = new Map<string, { desconto_percentual: number; vencida: boolean }>();
  let tabelaVencida = false;
  if (tabelaIds.length) {
    const { data: tabs } = await supabase
      .from("tabelas_preco")
      .select("id, representada_id, data_fim, ativa, desconto_percentual")
      .in("id", tabelaIds);
    for (const id of tabelaIds) {
      const tab = (tabs ?? []).find((t) => t.id === id);
      if (!tab) return { ok: false, error: "Tabela de preço não encontrada." };
      if (tab.representada_id !== v.representada_id)
        return { ok: false, error: "A tabela de preço é de outra representada." };
      const vencida = !!(tab.data_fim && new Date(tab.data_fim as string) < new Date());
      if (vencida) tabelaVencida = true;
      tabInfo.set(id, { desconto_percentual: Number(tab.desconto_percentual ?? 0), vencida });
    }
  }

  // produtos: valida representada + pega preço bruto autoritativo
  const produtoIds = v.itens.map((i) => i.produto_id);
  const { data: produtos } = await supabase
    .from("produtos")
    .select("id, representada_id, ativo, sku, nome, descricao, preco_bruto")
    .in("id", produtoIds);
  const prodMap = new Map((produtos ?? []).map((p) => [p.id as string, p]));

  for (const it of v.itens) {
    const p = prodMap.get(it.produto_id);
    if (!p) return { ok: false, error: `Produto ${it.sku_snapshot} não encontrado.` };
    if (p.representada_id !== v.representada_id)
      return { ok: false, error: `Produto ${p.sku} é de outra representada.` };
    if (!p.ativo) return { ok: false, error: `Produto ${p.sku} está inativo.` };
  }

  // variações escolhidas: valida e pega o preço bruto próprio
  const variacaoIds = [
    ...new Set(v.itens.map((i) => i.variacao_id).filter((x): x is string => !!x)),
  ];
  const varMap = new Map<
    string,
    { id: string; produto_id: string; sku: string; atributos: Record<string, string>; preco_bruto: number | null; ativo: boolean }
  >();
  if (variacaoIds.length) {
    const { data: vars } = await supabase
      .from("produto_variacoes")
      .select("id, produto_id, sku, atributos, preco_bruto, ativo")
      .in("id", variacaoIds);
    for (const x of vars ?? [])
      varMap.set(x.id as string, {
        id: x.id as string,
        produto_id: x.produto_id as string,
        sku: x.sku as string,
        atributos: (x.atributos as Record<string, string>) ?? {},
        preco_bruto: x.preco_bruto != null ? Number(x.preco_bruto) : null,
        ativo: x.ativo as boolean,
      });
  }
  for (const it of v.itens) {
    if (!it.variacao_id) continue;
    const vx = varMap.get(it.variacao_id);
    if (!vx) return { ok: false, error: `Variação de ${it.sku_snapshot} não encontrada.` };
    if (vx.produto_id !== it.produto_id)
      return { ok: false, error: `Variação ${vx.sku} não pertence ao produto informado.` };
    if (!vx.ativo) return { ok: false, error: `Variação ${vx.sku} está inativa.` };
  }
  const varLabel = (atributos: Record<string, string>) =>
    Object.values(atributos ?? {}).filter(Boolean).join(" / ");

  // override do preço líquido por (tabela, produto)
  const overrideMap = new Map<string, number>(); // chave: `${tabelaId}:${produtoId}`
  if (tabelaIds.length) {
    const { data: ov } = await supabase
      .from("produtos_precos")
      .select("tabela_preco_id, produto_id, preco")
      .in("tabela_preco_id", tabelaIds)
      .in("produto_id", produtoIds);
    for (const o of ov ?? [])
      if (o.preco != null)
        overrideMap.set(`${o.tabela_preco_id}:${o.produto_id}`, Number(o.preco));
  }

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const itensCalcInput = v.itens.map((it) => {
    const tid = it.tabela_preco_id ?? v.tabela_preco_id ?? null;
    let preco = it.preco_tabela;
    if (tid) {
      const ov = overrideMap.get(`${tid}:${it.produto_id}`);
      const vx = it.variacao_id ? varMap.get(it.variacao_id) : null;
      const bruto = Number(
        brutoEfetivo(vx?.preco_bruto ?? null, prodMap.get(it.produto_id)?.preco_bruto ?? null) ?? 0
      );
      preco = ov != null ? ov : round2(bruto * (1 - (tabInfo.get(tid)?.desconto_percentual ?? 0) / 100));
    }
    return {
      quantidade: it.quantidade,
      preco_tabela: preco,
      desconto_item_percentual: it.desconto_item_percentual,
      desconto_cascata: it.desconto_cascata,
      preco_liquido_manual: it.preco_liquido_manual ?? null,
    };
  });

  const calc = calcPedido({
    itens: itensCalcInput,
    desconto_modo: v.desconto_modo,
    desconto_input: v.desconto_input,
    desconto_cascata: v.desconto_cascata,
  });

  // validações de desconto / mínimo
  const warnings: string[] = [];
  const descMax = Number(rep.desconto_maximo_padrao ?? 0);
  if (descMax > 0 && calc.desconto_percentual > descMax) {
    if (g.profile!.role === "vendedor")
      warnings.push(
        `Desconto de ${calc.desconto_percentual.toFixed(1)}% acima do limite (${descMax}%). Pedido enviado para aprovação.`
      );
    else warnings.push(`Desconto acima do limite recomendado (${descMax}%).`);
  }
  if (Number(rep.pedido_minimo ?? 0) > 0 && calc.valor_total < Number(rep.pedido_minimo)) {
    warnings.push(
      `Pedido abaixo do mínimo da representada (mín. R$ ${Number(rep.pedido_minimo).toFixed(2)}).`
    );
  }
  if (tabelaVencida) warnings.push("A tabela de preço selecionada está vencida.");

  const precisaAprovacao =
    g.profile!.role === "vendedor" && descMax > 0 && calc.desconto_percentual > descMax;
  const status = precisaAprovacao ? "aguardando_aprovacao" : "orcamento";

  const header = {
    cliente_id: v.cliente_id,
    representada_id: v.representada_id,
    tabela_preco_id: v.tabela_preco_id ?? null,
    vendedor_id: v.vendedor_id ?? cliente.vendedor_id ?? g.profile!.id,
    condicao_pagamento: v.condicao_pagamento ?? null,
    forma_pagamento: v.forma_pagamento ?? null,
    previsao_entrega: v.previsao_entrega ?? null,
    observacao_cliente: v.observacao_cliente ?? null,
    observacao_representada: v.observacao_representada ?? null,
    observacao_interna: v.observacao_interna ?? null,
    subtotal: calc.subtotal,
    desconto_percentual: calc.desconto_percentual,
    desconto_valor: calc.desconto_valor,
    desconto_cascata: calc.desconto_cascata,
    valor_total: calc.valor_total,
    updated_by: g.profile!.id,
  };

  const itensRows = v.itens.map((it, idx) => {
    const p = prodMap.get(it.produto_id)!;
    const ci = calc.itens[idx];
    const vx = it.variacao_id ? varMap.get(it.variacao_id) : null;
    const label = vx ? varLabel(vx.atributos) : "";
    return {
      produto_id: it.produto_id,
      variacao_id: it.variacao_id ?? null,
      sku_snapshot: (vx?.sku ?? p.sku) as string,
      descricao_snapshot: label ? `${p.nome as string} — ${label}` : (p.nome as string),
      quantidade: ci.quantidade,
      preco_tabela: ci.preco_tabela,
      desconto_item_percentual: ci.desconto_item_percentual,
      desconto_cascata: ci.desconto_cascata,
      preco_liquido_manual: ci.preco_liquido_manual,
      tabela_preco_id: it.tabela_preco_id ?? null,
      desconto_item_valor: ci.desconto_item_valor,
      preco_unitario_final: ci.preco_unitario_final,
      valor_total: ci.valor_total,
    };
  });

  if (id) {
    // edição: só orçamento/aguardando
    const { data: atual } = await supabase.from("pedidos").select("status").eq("id", id).maybeSingle();
    if (!atual) return { ok: false, error: "Pedido não encontrado." };
    if (["faturado", "em_transporte", "entregue", "cancelado", "rejeitado"].includes(atual.status as string))
      return { ok: false, error: "Este pedido não pode mais ser editado." };

    const { error: e1 } = await supabase.from("pedidos").update(header).eq("id", id);
    if (e1) return { ok: false, error: e1.message };
    await supabase.from("pedido_itens").delete().eq("pedido_id", id);
    const { error: e2 } = await supabase
      .from("pedido_itens")
      .insert(itensRows.map((r) => ({ ...r, pedido_id: id })));
    if (e2) return { ok: false, error: e2.message };
    await sincronizarComissaoPedido(id);
    revalidatePath("/sistema/pedidos");
    revalidatePath(`/sistema/pedidos/${id}`);
    return { ok: true, id, warning: warnings.join(" ") || undefined };
  }

  const { data: novo, error } = await supabase
    .from("pedidos")
    .insert({ ...header, status, created_by: g.profile!.id })
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

  await sincronizarComissaoPedido(novo.id as string);
  revalidatePath("/sistema/pedidos");
  return {
    ok: true,
    id: novo.id as string,
    numero: novo.numero as number,
    warning: warnings.join(" ") || undefined,
  };
}

export async function alterarStatusPedido(
  id: string,
  status: string,
  descricao?: string
): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();

  const { error } = await supabase
    .from("pedidos")
    .update({ status, updated_by: g.profile!.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (descricao) {
    await supabase.from("pedido_historico").insert({
      pedido_id: id,
      status_novo: status,
      descricao,
      usuario_id: g.profile!.id,
    });
  }

  const { data: ped } = await supabase
    .from("pedidos")
    .select("numero, cliente_id, data_pedido, vendedor_id")
    .eq("id", id)
    .maybeSingle();

  // marca última compra do cliente quando fatura
  if (status === "faturado" && ped) {
    await supabase
      .from("clientes")
      .update({ data_ultima_compra: String(ped.data_pedido).slice(0, 10), status: "ativo" })
      .eq("id", ped.cliente_id as string);
  }

  // avisa o vendedor do pedido (se não foi ele quem mudou)
  if (
    ped?.vendedor_id &&
    ped.vendedor_id !== g.profile!.id &&
    ["confirmado", "faturado", "cancelado", "rejeitado"].includes(status)
  ) {
    await criarNotificacao({
      userId: ped.vendedor_id as string,
      tipo: "pedido",
      titulo: `Pedido #${ped.numero} — ${STATUS_LABEL.get(status) ?? status}`,
      descricao: descricao || `Status alterado por ${g.profile!.nome ?? g.profile!.email}.`,
      link: `/sistema/pedidos/${id}`,
    });
  }

  await sincronizarComissaoPedido(id);

  revalidatePath("/sistema/pedidos");
  revalidatePath(`/sistema/pedidos/${id}`);
  revalidatePath("/sistema/comissoes");
  return { ok: true, id };
}

export async function duplicarPedido(id: string): Promise<ActionResult<{ id?: string }>> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();

  const { data: ped } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
  if (!ped) return { ok: false, error: "Pedido não encontrado." };
  const { data: itens } = await supabase.from("pedido_itens").select("*").eq("pedido_id", id);

  const { data: novo, error } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: ped.cliente_id,
      representada_id: ped.representada_id,
      tabela_preco_id: ped.tabela_preco_id,
      vendedor_id: ped.vendedor_id,
      status: "orcamento",
      subtotal: ped.subtotal,
      desconto_percentual: ped.desconto_percentual,
      desconto_valor: ped.desconto_valor,
      desconto_cascata: ped.desconto_cascata ?? [],
      valor_total: ped.valor_total,
      condicao_pagamento: ped.condicao_pagamento,
      forma_pagamento: ped.forma_pagamento,
      observacao_cliente: ped.observacao_cliente,
      observacao_interna: `Duplicado do pedido #${ped.numero}`,
      created_by: g.profile!.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (itens?.length) {
    await supabase.from("pedido_itens").insert(
      itens.map((it) => ({
        pedido_id: novo.id as string,
        produto_id: it.produto_id,
        variacao_id: it.variacao_id ?? null,
        sku_snapshot: it.sku_snapshot,
        descricao_snapshot: it.descricao_snapshot,
        quantidade: it.quantidade,
        preco_tabela: it.preco_tabela,
        desconto_item_percentual: it.desconto_item_percentual,
        desconto_cascata: it.desconto_cascata ?? [],
        preco_liquido_manual: it.preco_liquido_manual ?? null,
        tabela_preco_id: it.tabela_preco_id ?? null,
        desconto_item_valor: it.desconto_item_valor,
        preco_unitario_final: it.preco_unitario_final,
        valor_total: it.valor_total,
      }))
    );
  }

  revalidatePath("/sistema/pedidos");
  return { ok: true, id: novo.id as string };
}

export async function excluirPedido(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  if (!canManage(g.profile!.role))
    return { ok: false, error: "Apenas gerente/admin podem excluir pedidos." };
  const supabase = await createSistemaClient();
  const admin = await createSistemaAdminClient();
  await admin.from("comissoes").delete().eq("pedido_id", id);
  const { error } = await supabase.from("pedidos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/pedidos");
  revalidatePath("/sistema/comissoes");
  return { ok: true };
}
