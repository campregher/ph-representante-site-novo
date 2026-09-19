"use server";

import { revalidatePath } from "next/cache";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { publicarAnuncioML, atualizarAnuncioML, type AnuncioProduto } from "@/lib/sistema/ml-catalogo";
import { margemMinimaEfetiva, precoMinimoVenda } from "@/lib/sistema/preco";
import { formatBRL } from "@/lib/sistema/format";
import type { ActionResult } from "@/lib/sistema/types";

type Db = Awaited<ReturnType<typeof createSistemaAdminClient>>;

/** Resolve o cliente pelo portal_token e garante que o cadastro está liberado
 *  (mesma condição que libera o catálogo no /drop/portal/[token]). */
async function resolveClienteLiberado(
  portalToken: string
): Promise<{ db: Db; clienteId: string } | { error: string }> {
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

async function buscarProdutoElegivel(
  db: Db,
  produtoId: string
): Promise<{ produto: AnuncioProduto; precoMinimo: number } | { error: string }> {
  const { data: p } = await db
    .from("produtos")
    .select(
      "id, sku, nome, descricao, marca, imagem_url, custo, ativo, estoque_atual, ml_category_id, margem_minima_percentual, categoria:categorias_produtos(margem_minima_percentual)"
    )
    .eq("id", produtoId)
    .eq("linha_propria", true)
    .maybeSingle();
  if (!p || !p.ativo || Number(p.estoque_atual) <= 0) return { error: "Produto indisponível." };
  const categoria = p.categoria as unknown as { margem_minima_percentual: number | null } | null;
  const margem = margemMinimaEfetiva(p.margem_minima_percentual as number | null, categoria?.margem_minima_percentual);
  const precoMinimo = precoMinimoVenda(p.custo as number | null, margem);
  if (precoMinimo == null) return { error: "Produto sem margem mínima definida." };
  return {
    produto: {
      id: p.id as string,
      sku: p.sku as string,
      nome: p.nome as string,
      descricao: p.descricao as string | null,
      marca: p.marca as string | null,
      imagem_url: p.imagem_url as string | null,
      ml_category_id: p.ml_category_id as string | null,
    },
    precoMinimo,
  };
}

export async function publicarProdutoML(
  portalToken: string,
  produtoId: string,
  precoRevenda: number
): Promise<ActionResult<{ permalink: string }>> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const pr = await buscarProdutoElegivel(ctx.db, produtoId);
  if ("error" in pr) return { ok: false, error: pr.error };
  if (!Number.isFinite(precoRevenda) || precoRevenda < pr.precoMinimo)
    return { ok: false, error: `Preço mínimo pra esse produto é ${formatBRL(pr.precoMinimo)}.` };

  const res = await publicarAnuncioML(ctx.clienteId, pr.produto, precoRevenda);
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

export async function publicarEmMassaML(
  portalToken: string,
  itens: PublicarEmMassaItem[]
): Promise<ActionResult<{ resultados: PublicarEmMassaResultado[] }>> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const resultados: PublicarEmMassaResultado[] = [];
  for (const item of itens) {
    const pr = await buscarProdutoElegivel(ctx.db, item.produtoId);
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
    const res = await publicarAnuncioML(ctx.clienteId, pr.produto, item.precoRevenda);
    resultados.push({ produtoId: item.produtoId, ok: res.ok, error: res.ok ? undefined : res.error });
  }

  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true, resultados };
}

async function mudarStatusAnuncio(
  portalToken: string,
  produtoId: string,
  status: "active" | "paused"
): Promise<ActionResult> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { data: anuncio } = await ctx.db
    .from("seller_ml_anuncios")
    .select("ml_item_id")
    .eq("cliente_id", ctx.clienteId)
    .eq("produto_id", produtoId)
    .maybeSingle();
  if (!anuncio) return { ok: false, error: "Anúncio não encontrado." };

  const res = await atualizarAnuncioML(ctx.clienteId, produtoId, anuncio.ml_item_id as string, { status });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true };
}

export async function pausarAnuncioML(portalToken: string, produtoId: string): Promise<ActionResult> {
  return mudarStatusAnuncio(portalToken, produtoId, "paused");
}

export async function reativarAnuncioML(portalToken: string, produtoId: string): Promise<ActionResult> {
  return mudarStatusAnuncio(portalToken, produtoId, "active");
}

export async function atualizarPrecoAnuncioML(
  portalToken: string,
  produtoId: string,
  novoPreco: number
): Promise<ActionResult> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const pr = await buscarProdutoElegivel(ctx.db, produtoId);
  if ("error" in pr) return { ok: false, error: pr.error };
  if (!Number.isFinite(novoPreco) || novoPreco < pr.precoMinimo)
    return { ok: false, error: `Preço mínimo pra esse produto é ${formatBRL(pr.precoMinimo)}.` };

  const { data: anuncio } = await ctx.db
    .from("seller_ml_anuncios")
    .select("ml_item_id")
    .eq("cliente_id", ctx.clienteId)
    .eq("produto_id", produtoId)
    .maybeSingle();
  if (!anuncio) return { ok: false, error: "Anúncio não encontrado." };

  const res = await atualizarAnuncioML(ctx.clienteId, produtoId, anuncio.ml_item_id as string, { price: novoPreco });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true };
}
