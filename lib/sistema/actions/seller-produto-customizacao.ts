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
  /** Método de envio que o seller usa pra esse produto — obrigatório pra
   *  publicar (ver buscarProdutoElegivel/buscarGrupoElegivel em
   *  seller-ml-catalogo.ts), diferente de nome/descrição/imagens porque não
   *  tem um "padrão da PH" pra cair de volta quando vazio. */
  metodoEnvio: string;
  /** Clássico ou Premium — vazio = Premium (comportamento de antes), não é
   *  obrigatório como o método de envio (ver resolverListingType em
   *  dropshipping-ml-catalogo.ts). */
  tipoAnuncio: string;
}

/**
 * Salva como ESSE seller quer que um produto apareça no anúncio dele
 * (título, descrição, fotos, método de envio) — sem tocar no cadastro do
 * admin (dropshipping.produtos), que continua valendo pros outros sellers
 * que revendem o mesmo produto. Nome/descrição/imagens vazios = volta a
 * usar o valor do admin (ver merge em lib/sistema/seller-catalogo.ts e
 * buscarProdutoElegivel em seller-ml-catalogo.ts).
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
      metodo_envio: dados.metodoEnvio.trim() || null,
      tipo_anuncio: dados.tipoAnuncio.trim() || null,
    },
    { onConflict: "cliente_id,produto_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true };
}

/**
 * Aplica método de envio + tipo de anúncio pra VÁRIOS produtos de uma vez
 * (botão "Editar em massa", antes de publicar em lote) — só mexe nesses dois
 * campos, preserva nome/descrição/fotos que cada produto já tinha
 * customizado (upsert parcial: colunas fora do objeto não são tocadas pelo
 * `ON CONFLICT DO UPDATE`, então não arrisca apagar customização de título
 * de ninguém).
 */
export async function aplicarConfigEnvioEmMassa(
  portalToken: string,
  produtoIds: string[],
  config: { metodoEnvio: string; tipoAnuncio: string }
): Promise<ActionResult> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (produtoIds.length === 0) return { ok: false, error: "Selecione ao menos um produto." };
  if (!config.metodoEnvio.trim()) return { ok: false, error: "Escolha o método de envio." };

  const dropDb = await createDropshippingAdminClient();
  const { error } = await dropDb.from("seller_produto_customizacoes").upsert(
    produtoIds.map((produtoId) => ({
      cliente_id: ctx.clienteId,
      produto_id: produtoId,
      metodo_envio: config.metodoEnvio.trim(),
      tipo_anuncio: config.tipoAnuncio.trim() || null,
    })),
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
