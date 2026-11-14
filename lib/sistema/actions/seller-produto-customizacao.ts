"use server";

import { revalidatePath } from "next/cache";
import { createSistemaAdminClient, createDropshippingAdminClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/sistema/types";

/** Mesma checagem de acesso usada no resto do catálogo do seller — ver
 *  lib/sistema/actions/seller-ml-catalogo.ts. */
async function resolveClienteLiberado(portalToken: string): Promise<{ clienteId: string } | { error: string }> {
  const db = await createSistemaAdminClient();
  const { data: cliente } = await db
    .from("clientes")
    .select("id, status, email_confirmado")
    .eq("portal_token", portalToken)
    .maybeSingle();
  if (!cliente) return { error: "Link inválido." };
  if (cliente.status === "bloqueado") return { error: "Acesso bloqueado." };
  if (!cliente.email_confirmado || cliente.status === "prospect")
    return { error: "Cadastro ainda não liberado." };
  return { clienteId: cliente.id as string };
}

export interface CustomizacaoProdutoInput {
  nome: string;
  descricao: string;
  imagens: string[];
}

/**
 * Salva como ESSE seller quer que um produto apareça no anúncio dele
 * (título, descrição, fotos) — sem tocar no cadastro do admin
 * (dropshipping.produtos), que continua valendo pros outros sellers que
 * revendem o mesmo produto. Campo vazio = volta a usar o valor do admin
 * (ver merge em lib/sistema/seller-catalogo.ts e buscarProdutoElegivel em
 * seller-ml-catalogo.ts).
 */
export async function salvarCustomizacaoProdutoSeller(
  portalToken: string,
  produtoId: string,
  dados: CustomizacaoProdutoInput
): Promise<ActionResult> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const dropDb = await createDropshippingAdminClient();
  const { error } = await dropDb.from("seller_produto_customizacoes").upsert(
    {
      cliente_id: ctx.clienteId,
      produto_id: produtoId,
      nome: dados.nome.trim() || null,
      descricao: dados.descricao.trim() || null,
      imagens: dados.imagens.filter(Boolean).length ? dados.imagens.filter(Boolean) : null,
    },
    { onConflict: "cliente_id,produto_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true };
}

/** Apaga a customização — o produto volta a mostrar exatamente o que o admin cadastrou. */
export async function restaurarProdutoPadraoSeller(portalToken: string, produtoId: string): Promise<ActionResult> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const dropDb = await createDropshippingAdminClient();
  const { error } = await dropDb
    .from("seller_produto_customizacoes")
    .delete()
    .eq("cliente_id", ctx.clienteId)
    .eq("produto_id", produtoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true };
}
