"use server";

import { revalidatePath } from "next/cache";
import { createSistemaAdminClient, createDropshippingAdminClient } from "@/lib/supabase/server";
import { publicarAnuncioMLDrop, atualizarAnuncioMLDrop, type AnuncioProdutoDrop } from "@/lib/sistema/dropshipping-ml-catalogo";
import { formatBRL } from "@/lib/sistema/format";
import type { ActionResult } from "@/lib/sistema/types";

type SistemaDb = Awaited<ReturnType<typeof createSistemaAdminClient>>;
type DropDb = Awaited<ReturnType<typeof createDropshippingAdminClient>>;

/** Resolve o cliente pelo portal_token e garante que o cadastro está liberado
 *  (mesma condição que libera o catálogo no /drop/portal/[token]). Identidade
 *  do seller mora no schema `comercial`, mesmo pro catálogo de dropshipping. */
async function resolveClienteLiberado(
  portalToken: string
): Promise<{ db: SistemaDb; clienteId: string } | { error: string }> {
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
  return { db, clienteId: cliente.id as string };
}

/** Garante que a conta do ML informada é mesmo desse seller — nunca confia
 *  num mlContaId vindo do client sem checar a dona (evitaria publicar/mexer
 *  na conta de outro seller). */
async function checarDonoDaContaMl(db: SistemaDb, clienteId: string, mlContaId: string): Promise<string | null> {
  const { data } = await db
    .from("cliente_ml_tokens")
    .select("id")
    .eq("id", mlContaId)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  return data ? null : "Conta do Mercado Livre não encontrada.";
}

async function buscarProdutoElegivel(
  db: DropDb,
  produtoId: string
): Promise<{ produto: AnuncioProdutoDrop; precoMinimo: number } | { error: string }> {
  const { data: p } = await db
    .from("produtos")
    .select(
      "id, sku, nome, descricao, marca, imagem_url, ml_category_id, transporte_aceito, ativo, estoque_atual, produto_precos(preco_sugerido, tabela:tabelas_preco(codigo))"
    )
    .eq("id", produtoId)
    .maybeSingle();
  if (!p || !p.ativo || Number(p.estoque_atual) <= 0) return { error: "Produto indisponível." };
  const precos = p.produto_precos as unknown as { preco_sugerido: number | null; tabela: { codigo: string } | null }[];
  const cnpj = precos.find((x) => x.tabela?.codigo === "cnpj");
  const precoMinimo = cnpj?.preco_sugerido ?? null;
  if (precoMinimo == null) return { error: "Produto sem preço sugerido definido." };
  return {
    produto: {
      id: p.id as string,
      sku: p.sku as string,
      nome: p.nome as string,
      descricao: p.descricao as string | null,
      marca: p.marca as string | null,
      imagem_url: p.imagem_url as string | null,
      ml_category_id: p.ml_category_id as string | null,
      transporte_aceito: (p.transporte_aceito as string[] | null) ?? [],
    },
    precoMinimo,
  };
}

export async function publicarProdutoML(
  portalToken: string,
  mlContaId: string,
  produtoId: string,
  precoRevenda: number
): Promise<ActionResult<{ permalink: string }>> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const donoErro = await checarDonoDaContaMl(ctx.db, ctx.clienteId, mlContaId);
  if (donoErro) return { ok: false, error: donoErro };
  const dropDb = await createDropshippingAdminClient();
  const pr = await buscarProdutoElegivel(dropDb, produtoId);
  if ("error" in pr) return { ok: false, error: pr.error };
  if (!Number.isFinite(precoRevenda) || precoRevenda < pr.precoMinimo)
    return { ok: false, error: `Preço mínimo pra esse produto é ${formatBRL(pr.precoMinimo)}.` };

  const res = await publicarAnuncioMLDrop(ctx.clienteId, mlContaId, pr.produto, precoRevenda);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true, permalink: res.permalink };
}

export interface PublicarEmMassaItem {
  produtoId: string;
  precoRevenda: number;
}

export interface PublicarEmMassaResultado {
  produtoId: string;
  ok: boolean;
  error?: string;
}

/** Publica vários produtos de uma vez, todos na MESMA conta do ML escolhida. */
export async function publicarEmMassaML(
  portalToken: string,
  mlContaId: string,
  itens: PublicarEmMassaItem[]
): Promise<ActionResult<{ resultados: PublicarEmMassaResultado[] }>> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const donoErro = await checarDonoDaContaMl(ctx.db, ctx.clienteId, mlContaId);
  if (donoErro) return { ok: false, error: donoErro };
  const dropDb = await createDropshippingAdminClient();

  const resultados: PublicarEmMassaResultado[] = [];
  for (const item of itens) {
    const pr = await buscarProdutoElegivel(dropDb, item.produtoId);
    if ("error" in pr) {
      resultados.push({ produtoId: item.produtoId, ok: false, error: pr.error });
      continue;
    }
    if (!Number.isFinite(item.precoRevenda) || item.precoRevenda < pr.precoMinimo) {
      resultados.push({
        produtoId: item.produtoId,
        ok: false,
        error: `Preço mínimo é ${formatBRL(pr.precoMinimo)}.`,
      });
      continue;
    }
    const res = await publicarAnuncioMLDrop(ctx.clienteId, mlContaId, pr.produto, item.precoRevenda);
    resultados.push({ produtoId: item.produtoId, ok: res.ok, error: res.ok ? undefined : res.error });
  }

  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true, resultados };
}

async function mudarStatusAnuncio(
  portalToken: string,
  mlContaId: string,
  produtoId: string,
  status: "active" | "paused"
): Promise<ActionResult> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const dropDb = await createDropshippingAdminClient();
  const { data: anuncio } = await dropDb
    .from("seller_ml_anuncios")
    .select("ml_item_id")
    .eq("cliente_id", ctx.clienteId)
    .eq("ml_conta_id", mlContaId)
    .eq("produto_id", produtoId)
    .maybeSingle();
  if (!anuncio) return { ok: false, error: "Anúncio não encontrado." };

  const res = await atualizarAnuncioMLDrop(mlContaId, produtoId, anuncio.ml_item_id as string, { status });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true };
}

export async function pausarAnuncioML(
  portalToken: string,
  mlContaId: string,
  produtoId: string
): Promise<ActionResult> {
  return mudarStatusAnuncio(portalToken, mlContaId, produtoId, "paused");
}

export async function reativarAnuncioML(
  portalToken: string,
  mlContaId: string,
  produtoId: string
): Promise<ActionResult> {
  return mudarStatusAnuncio(portalToken, mlContaId, produtoId, "active");
}

export async function atualizarPrecoAnuncioML(
  portalToken: string,
  mlContaId: string,
  produtoId: string,
  novoPreco: number
): Promise<ActionResult> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const dropDb = await createDropshippingAdminClient();

  const pr = await buscarProdutoElegivel(dropDb, produtoId);
  if ("error" in pr) return { ok: false, error: pr.error };
  if (!Number.isFinite(novoPreco) || novoPreco < pr.precoMinimo)
    return { ok: false, error: `Preço mínimo pra esse produto é ${formatBRL(pr.precoMinimo)}.` };

  const { data: anuncio } = await dropDb
    .from("seller_ml_anuncios")
    .select("ml_item_id")
    .eq("cliente_id", ctx.clienteId)
    .eq("ml_conta_id", mlContaId)
    .eq("produto_id", produtoId)
    .maybeSingle();
  if (!anuncio) return { ok: false, error: "Anúncio não encontrado." };

  const res = await atualizarAnuncioMLDrop(mlContaId, produtoId, anuncio.ml_item_id as string, { price: novoPreco });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true };
}
