"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { aplicarMovimento, custoMedio } from "@/lib/sistema/estoque-mov";
import {
  fornecedorSchema,
  produtoProprioSchema,
  compraSchema,
  ajusteEstoqueSchema,
} from "@/lib/sistema/schemas";
import { onlyDigits } from "@/lib/sistema/format";
import type { ActionResult } from "@/lib/sistema/types";

async function guard() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (!canManage(profile.role))
    return { profile: null, error: "Apenas admin/gerente podem gerenciar a linha própria." as const };
  return { profile, error: null };
}

// ─────────────────────────────── Fornecedores ─────────────────────────────

export async function salvarFornecedor(id: string | null, raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const parsed = fornecedorSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const v = parsed.data;
  const row = { ...v, cnpj: v.cnpj ? onlyDigits(v.cnpj) : null };
  const supabase = await createSistemaClient();
  if (id) {
    const { error } = await supabase.from("fornecedores").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("fornecedores")
      .insert({ ...row, created_by: g.profile!.id });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/sistema/estoque/fornecedores");
  return { ok: true };
}

export async function excluirFornecedor(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/estoque/fornecedores");
  return { ok: true };
}

// ────────────────────────── Produtos próprios ─────────────────────────────

export async function salvarProdutoProprio(id: string | null, raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const parsed = produtoProprioSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const v = parsed.data;
  const row = {
    sku: v.sku,
    nome: v.nome,
    descricao: v.descricao,
    fornecedor_id: v.fornecedor_id || null,
    ncm: v.ncm,
    ean: v.ean,
    unidade: v.unidade || "UN",
    imagem_url: v.imagem_url,
    custo: v.custo,
    preco_bruto: v.preco_bruto,
    estoque_minimo: Math.round(Number(v.estoque_minimo ?? 0)),
    peso: v.peso,
    altura: v.altura,
    largura: v.largura,
    comprimento: v.comprimento,
    ativo: v.ativo,
    observacoes: v.observacoes,
    linha_propria: true,
    representada_id: null,
  };
  const supabase = await createSistemaClient();
  if (id) {
    const { error } = await supabase.from("produtos").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("produtos")
      .insert({ ...row, created_by: g.profile!.id });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/sistema/estoque");
  return { ok: true };
}

// ─────────────────────────────── Compras ──────────────────────────────────

export async function salvarCompra(raw: unknown): Promise<ActionResult<{ id?: string }>> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const parsed = compraSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const v = parsed.data;
  const supabase = await createSistemaClient();

  const subtotalItens = v.itens.reduce((s, it) => s + it.quantidade * it.custo_unitario, 0);
  const frete = Number(v.frete ?? 0);
  const outras = Number(v.outras_despesas ?? 0);
  const valorTotal = Math.round((subtotalItens + frete + outras) * 100) / 100;

  const { data: compra, error } = await supabase
    .from("compras")
    .insert({
      fornecedor_id: v.fornecedor_id || null,
      numero_nota: v.numero_nota,
      data_compra: v.data_compra || new Date().toISOString().slice(0, 10),
      frete,
      outras_despesas: outras,
      valor_total: valorTotal,
      status: "recebida",
      observacoes: v.observacoes,
      created_by: g.profile!.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  const compraId = compra.id as string;

  const { error: eItens } = await supabase.from("compra_itens").insert(
    v.itens.map((it) => ({
      compra_id: compraId,
      produto_id: it.produto_id,
      quantidade: it.quantidade,
      custo_unitario: it.custo_unitario,
      subtotal: Math.round(it.quantidade * it.custo_unitario * 100) / 100,
    }))
  );
  if (eItens) {
    await supabase.from("compras").delete().eq("id", compraId);
    return { ok: false, error: `Falha nos itens: ${eItens.message}` };
  }

  // entrada de estoque + custo médio
  for (const it of v.itens) {
    const { data: p } = await supabase
      .from("produtos")
      .select("custo, estoque_atual")
      .eq("id", it.produto_id)
      .maybeSingle();
    const novoCusto = custoMedio(
      p?.custo ?? null,
      Number(p?.estoque_atual ?? 0),
      it.custo_unitario,
      it.quantidade
    );
    await aplicarMovimento(supabase, {
      produtoId: it.produto_id,
      delta: it.quantidade,
      tipo: "entrada",
      origemTipo: "compra",
      origemId: compraId,
      observacao: v.numero_nota ? `NF ${v.numero_nota}` : "Compra",
      userId: g.profile!.id,
    });
    await supabase.from("produtos").update({ custo: novoCusto }).eq("id", it.produto_id);
  }

  revalidatePath("/sistema/estoque");
  revalidatePath("/sistema/estoque/compras");
  return { ok: true, id: compraId };
}

export async function cancelarCompra(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { data: compra } = await supabase
    .from("compras")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!compra) return { ok: false, error: "Compra não encontrada." };
  if (compra.status === "cancelada") return { ok: true };

  const { data: itens } = await supabase
    .from("compra_itens")
    .select("produto_id, quantidade")
    .eq("compra_id", id);
  for (const it of itens ?? []) {
    if (!it.produto_id) continue;
    await aplicarMovimento(supabase, {
      produtoId: it.produto_id as string,
      delta: -Number(it.quantidade),
      tipo: "ajuste",
      origemTipo: "compra",
      origemId: id,
      observacao: "Estorno de compra cancelada",
      userId: g.profile!.id,
    });
  }
  await supabase.from("compras").update({ status: "cancelada" }).eq("id", id);
  revalidatePath("/sistema/estoque");
  revalidatePath("/sistema/estoque/compras");
  return { ok: true };
}

// ──────────────────────────── Ajuste de estoque ──────────────────────────

export async function ajustarEstoque(raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const parsed = ajusteEstoqueSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { produto_id, novo_saldo, motivo } = parsed.data;
  const supabase = await createSistemaClient();
  const { data: p } = await supabase
    .from("produtos")
    .select("estoque_atual")
    .eq("id", produto_id)
    .maybeSingle();
  if (!p) return { ok: false, error: "Produto não encontrado." };
  const delta = novo_saldo - Number(p.estoque_atual ?? 0);
  if (delta === 0) return { ok: true };
  await aplicarMovimento(supabase, {
    produtoId: produto_id,
    delta,
    tipo: "ajuste",
    origemTipo: "ajuste",
    observacao: motivo,
    userId: g.profile!.id,
  });
  revalidatePath("/sistema/estoque");
  return { ok: true };
}
