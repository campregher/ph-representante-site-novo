"use server";

import { revalidatePath } from "next/cache";
import { createSistemaAdminClient, createDropshippingAdminClient } from "@/lib/supabase/server";
import {
  publicarAnuncioMLDrop,
  atualizarAnuncioMLDrop,
  publicarGrupoMLDrop,
  type AnuncioProdutoDrop,
  type AnuncioGrupoDrop,
  type VariacaoProdutoDrop,
} from "@/lib/sistema/dropshipping-ml-catalogo";
import { formatBRL } from "@/lib/sistema/format";
import type { ActionResult } from "@/lib/sistema/types";

type SistemaDb = Awaited<ReturnType<typeof createSistemaAdminClient>>;
type DropDb = Awaited<ReturnType<typeof createDropshippingAdminClient>>;

/** Resolve o cliente pelo portal_token e garante que o cadastro está liberado
 *  (mesma condição que libera o catálogo no /drop/portal/[token]). Identidade
 *  do seller mora no schema `comercial`, mesmo pro catálogo de dropshipping. */
async function resolveClienteLiberado(
  portalToken: string
): Promise<{ db: SistemaDb; clienteId: string; metodosEnvio: string[] } | { error: string }> {
  const db = await createSistemaAdminClient();
  const { data: cliente } = await db
    .from("clientes")
    .select("id, status, email_confirmado, onboarding_metodos_envio")
    .eq("portal_token", portalToken)
    .maybeSingle();
  if (!cliente) return { error: "Link inválido." };
  if (cliente.status === "bloqueado") return { error: "Acesso bloqueado." };
  if (!cliente.email_confirmado || cliente.status === "prospect")
    return { error: "Cadastro ainda não liberado." };
  return {
    db,
    clienteId: cliente.id as string,
    metodosEnvio: (cliente.onboarding_metodos_envio as string[] | null) ?? [],
  };
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

/** Busca o produto pronto pra publicar, já aplicando a customização de
 *  título/descrição/fotos que esse seller tenha salvo pra ele (sem tocar no
 *  cadastro do admin — ver migration 046 e lib/sistema/seller-catalogo.ts). */
async function buscarProdutoElegivel(
  db: DropDb,
  produtoId: string,
  clienteId: string
): Promise<{ produto: AnuncioProdutoDrop; precoMinimo: number } | { error: string }> {
  const [{ data: p }, { data: custom }] = await Promise.all([
    db
      .from("produtos")
      .select(
        "id, sku, nome, descricao, marca, imagem_url, imagens, ml_category_id, transporte_aceito, ativo, estoque_atual, produto_precos(preco_sugerido, tabela:tabelas_preco(codigo))"
      )
      .eq("id", produtoId)
      .maybeSingle(),
    db
      .from("seller_produto_customizacoes")
      .select("nome, descricao, imagens")
      .eq("cliente_id", clienteId)
      .eq("produto_id", produtoId)
      .maybeSingle(),
  ]);
  if (!p || !p.ativo || Number(p.estoque_atual) <= 0) return { error: "Produto indisponível." };
  const precos = p.produto_precos as unknown as { preco_sugerido: number | null; tabela: { codigo: string } | null }[];
  const cnpj = precos.find((x) => x.tabela?.codigo === "cnpj");
  const precoMinimo = cnpj?.preco_sugerido ?? null;
  if (precoMinimo == null) return { error: "Produto sem preço sugerido definido." };
  const imagensCustom = custom?.imagens as string[] | null;
  const imagens = imagensCustom?.length ? imagensCustom : ((p.imagens as string[] | null) ?? []);
  return {
    produto: {
      id: p.id as string,
      sku: p.sku as string,
      nome: custom?.nome || (p.nome as string),
      descricao: custom?.descricao || (p.descricao as string | null),
      marca: p.marca as string | null,
      imagem_url: imagens[0] ?? (p.imagem_url as string | null),
      imagens,
      ml_category_id: p.ml_category_id as string | null,
      transporte_aceito: (p.transporte_aceito as string[] | null) ?? [],
    },
    precoMinimo,
  };
}

/** Mesma coisa que `buscarProdutoElegivel`, mas pra um GRUPO de variações
 *  (cor/acabamento) do mesmo produto, que precisam virar UM anúncio com
 *  variações no ML, não N anúncios simples separados (ver migration 047 e
 *  publicarAnuncioMLDropComVariacoes). Preço mínimo do grupo = o maior
 *  preço mínimo entre as variações, já que elas compartilham UM preço só. */
async function buscarGrupoElegivel(
  db: DropDb,
  produtoIds: string[],
  clienteId: string
): Promise<{ grupo: AnuncioGrupoDrop; precoMinimo: number } | { error: string }> {
  const [{ data: rows }, { data: customRows }] = await Promise.all([
    db
      .from("produtos")
      .select(
        "id, sku, nome, descricao, marca, imagens, variacao, ml_category_id, transporte_aceito, ativo, estoque_atual, produto_precos(preco_sugerido, tabela:tabelas_preco(codigo))"
      )
      .in("id", produtoIds),
    db.from("seller_produto_customizacoes").select("produto_id, nome, descricao, imagens").eq("cliente_id", clienteId).in("produto_id", produtoIds),
  ]);
  if (!rows || rows.length !== produtoIds.length) return { error: "Alguma variação desse produto não foi encontrada." };
  const indisponivel = rows.find((p) => !p.ativo || Number(p.estoque_atual) <= 0);
  if (indisponivel) return { error: `Variação "${indisponivel.sku}" está indisponível.` };

  const categorias = new Set(rows.map((p) => p.ml_category_id));
  if (categorias.size > 1 || categorias.has(null))
    return { error: "As variações desse produto não têm todas a mesma categoria do Mercado Livre definida — fale com a PH." };

  const customPorProduto = new Map((customRows ?? []).map((c) => [c.produto_id as string, c]));

  let precoMinimo = 0;
  const variantes: VariacaoProdutoDrop[] = [];
  for (const p of rows) {
    const precos = p.produto_precos as unknown as { preco_sugerido: number | null; tabela: { codigo: string } | null }[];
    const cnpj = precos.find((x) => x.tabela?.codigo === "cnpj");
    if (cnpj?.preco_sugerido == null) return { error: `Variação "${p.sku}" sem preço sugerido definido.` };
    precoMinimo = Math.max(precoMinimo, cnpj.preco_sugerido);
    const custom = customPorProduto.get(p.id as string);
    const imagensCustom = custom?.imagens as string[] | null;
    const imagens = imagensCustom?.length ? imagensCustom : ((p.imagens as string[] | null) ?? []);
    variantes.push({
      id: p.id as string,
      sku: p.sku as string,
      variacao: (p.variacao as string | null) || (p.sku as string),
      estoque_atual: Number(p.estoque_atual),
      imagens,
    });
  }

  const base = rows[0];
  const baseCustom = customPorProduto.get(base.id as string);
  return {
    grupo: {
      nome: baseCustom?.nome || (base.nome as string),
      descricao: baseCustom?.descricao || (base.descricao as string | null),
      marca: base.marca as string | null,
      ml_category_id: base.ml_category_id as string | null,
      transporte_aceito: (base.transporte_aceito as string[] | null) ?? [],
      variantes,
    },
    precoMinimo,
  };
}

/** Busca o(s) anúncio(s) já publicado(s) por esse grupo de produtos nessa
 *  conta — cada variação vira seu PRÓPRIO item no ML (ver
 *  `publicarGrupoMLDrop`), então normalmente é N ml_item_id distintos, um
 *  por produto/variação; agrupa por `ml_item_id` só por segurança (nunca
 *  assume 1:1), pra pausar/reativar/excluir alcançar todos. */
async function buscarAnunciosGrupo(
  dropDb: DropDb,
  clienteId: string,
  mlContaId: string,
  produtoIds: string[]
): Promise<{ mlItemId: string; produtoIds: string[] }[] | { error: string }> {
  const { data } = await dropDb
    .from("seller_ml_anuncios")
    .select("produto_id, ml_item_id")
    .eq("cliente_id", clienteId)
    .eq("ml_conta_id", mlContaId)
    .in("produto_id", produtoIds);
  if (!data || data.length === 0) return { error: "Anúncio não encontrado." };
  const porItem = new Map<string, string[]>();
  for (const d of data) {
    const mlItemId = d.ml_item_id as string;
    const lista = porItem.get(mlItemId) ?? [];
    lista.push(d.produto_id as string);
    porItem.set(mlItemId, lista);
  }
  return [...porItem.entries()].map(([mlItemId, pids]) => ({ mlItemId, produtoIds: pids }));
}

/** Publica cada variação (cor/acabamento) do grupo como item separado,
 *  agrupados visualmente pelo próprio ML (ver `publicarGrupoMLDrop`), em
 *  várias contas do ML de uma vez. */
export async function publicarGrupoMLVariasContas(
  portalToken: string,
  mlContaIds: string[],
  produtoIds: string[],
  precoRevenda: number
): Promise<ActionResult<{ resultados: PublicarVariasContasResultado[] }>> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (mlContaIds.length === 0) return { ok: false, error: "Escolha pelo menos uma conta do Mercado Livre." };
  if (produtoIds.length < 2) return { ok: false, error: "Selecione as variações do produto." };
  const dropDb = await createDropshippingAdminClient();
  const gr = await buscarGrupoElegivel(dropDb, produtoIds, ctx.clienteId);
  if ("error" in gr) return { ok: false, error: gr.error };
  if (!Number.isFinite(precoRevenda) || precoRevenda < gr.precoMinimo)
    return { ok: false, error: `Preço mínimo pra esse produto é ${formatBRL(gr.precoMinimo)}.` };

  const resultados: PublicarVariasContasResultado[] = [];
  for (const mlContaId of mlContaIds) {
    const donoErro = await checarDonoDaContaMl(ctx.db, ctx.clienteId, mlContaId);
    if (donoErro) {
      resultados.push({ mlContaId, ok: false, error: donoErro });
      continue;
    }
    const res = await publicarGrupoMLDrop(ctx.clienteId, mlContaId, gr.grupo, precoRevenda, ctx.metodosEnvio);
    if (!res.ok) {
      resultados.push({ mlContaId, ok: false, error: res.error });
      continue;
    }
    const falhas = res.resultados.filter((r) => !r.ok);
    const sucesso = res.resultados.find((r) => r.ok);
    resultados.push({
      mlContaId,
      ok: falhas.length === 0,
      error:
        falhas.length > 0
          ? `${falhas.length} variação(ões) falharam: ${falhas.map((f) => `${f.sku} (${f.error})`).join("; ")}`
          : undefined,
      permalink: sucesso?.permalink,
    });
  }
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true, resultados };
}

async function mudarStatusGrupoAnuncio(
  portalToken: string,
  mlContaId: string,
  produtoIds: string[],
  status: "active" | "paused"
): Promise<ActionResult> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const dropDb = await createDropshippingAdminClient();
  const anuncios = await buscarAnunciosGrupo(dropDb, ctx.clienteId, mlContaId, produtoIds);
  if ("error" in anuncios) return { ok: false, error: anuncios.error };
  for (const anuncio of anuncios) {
    const res = await atualizarAnuncioMLDrop(mlContaId, anuncio.produtoIds[0], anuncio.mlItemId, { status });
    if (!res.ok) return { ok: false, error: res.error };
  }
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true };
}

export async function pausarGrupoML(portalToken: string, mlContaId: string, produtoIds: string[]): Promise<ActionResult> {
  return mudarStatusGrupoAnuncio(portalToken, mlContaId, produtoIds, "paused");
}

export async function reativarGrupoML(portalToken: string, mlContaId: string, produtoIds: string[]): Promise<ActionResult> {
  return mudarStatusGrupoAnuncio(portalToken, mlContaId, produtoIds, "active");
}

export async function atualizarPrecoGrupoML(
  portalToken: string,
  mlContaId: string,
  produtoIds: string[],
  novoPreco: number
): Promise<ActionResult> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const dropDb = await createDropshippingAdminClient();
  const gr = await buscarGrupoElegivel(dropDb, produtoIds, ctx.clienteId);
  if ("error" in gr) return { ok: false, error: gr.error };
  if (!Number.isFinite(novoPreco) || novoPreco < gr.precoMinimo)
    return { ok: false, error: `Preço mínimo pra esse produto é ${formatBRL(gr.precoMinimo)}.` };
  const anuncios = await buscarAnunciosGrupo(dropDb, ctx.clienteId, mlContaId, produtoIds);
  if ("error" in anuncios) return { ok: false, error: anuncios.error };
  for (const anuncio of anuncios) {
    const res = await atualizarAnuncioMLDrop(mlContaId, anuncio.produtoIds[0], anuncio.mlItemId, { price: novoPreco });
    if (!res.ok) return { ok: false, error: res.error };
  }
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true };
}

/** Fecha o(s) anúncio(s) desse grupo no ML (definitivo — não dá pra reabrir)
 *  e apaga só os vínculos locais dos que fecharam de verdade, liberando a
 *  conta pra publicar de novo do zero. Se algum item falhar ao fechar,
 *  avisa quais SKUs continuam publicados e não apaga a linha deles, pra
 *  não perder o rastro de um anúncio que na real continua ativo no ML. */
export async function excluirGrupoAnuncioML(portalToken: string, mlContaId: string, produtoIds: string[]): Promise<ActionResult> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const dropDb = await createDropshippingAdminClient();
  const anuncios = await buscarAnunciosGrupo(dropDb, ctx.clienteId, mlContaId, produtoIds);
  if ("error" in anuncios) return { ok: false, error: anuncios.error };

  const produtoIdsFechados: string[] = [];
  const erros: string[] = [];
  for (const anuncio of anuncios) {
    const res = await atualizarAnuncioMLDrop(mlContaId, anuncio.produtoIds[0], anuncio.mlItemId, { status: "closed" });
    if (res.ok) produtoIdsFechados.push(...anuncio.produtoIds);
    else erros.push(res.error);
  }

  if (produtoIdsFechados.length > 0) {
    await dropDb
      .from("seller_ml_anuncios")
      .delete()
      .eq("cliente_id", ctx.clienteId)
      .eq("ml_conta_id", mlContaId)
      .in("produto_id", produtoIdsFechados);
  }
  revalidatePath(`/drop/portal/${portalToken}`);
  if (erros.length > 0) return { ok: false, error: `Alguns anúncios não fecharam: ${erros.join("; ")}` };
  return { ok: true };
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
  const pr = await buscarProdutoElegivel(dropDb, produtoId, ctx.clienteId);
  if ("error" in pr) return { ok: false, error: pr.error };
  if (!Number.isFinite(precoRevenda) || precoRevenda < pr.precoMinimo)
    return { ok: false, error: `Preço mínimo pra esse produto é ${formatBRL(pr.precoMinimo)}.` };

  const res = await publicarAnuncioMLDrop(ctx.clienteId, mlContaId, pr.produto, precoRevenda, ctx.metodosEnvio);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true, permalink: res.permalink };
}

export interface PublicarVariasContasResultado {
  mlContaId: string;
  ok: boolean;
  error?: string;
  permalink?: string;
}

/** Publica o MESMO produto em várias contas do ML do seller de uma vez. */
export async function publicarProdutoMLVariasContas(
  portalToken: string,
  mlContaIds: string[],
  produtoId: string,
  precoRevenda: number
): Promise<ActionResult<{ resultados: PublicarVariasContasResultado[] }>> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (mlContaIds.length === 0) return { ok: false, error: "Escolha pelo menos uma conta do Mercado Livre." };
  const dropDb = await createDropshippingAdminClient();
  const pr = await buscarProdutoElegivel(dropDb, produtoId, ctx.clienteId);
  if ("error" in pr) return { ok: false, error: pr.error };
  if (!Number.isFinite(precoRevenda) || precoRevenda < pr.precoMinimo)
    return { ok: false, error: `Preço mínimo pra esse produto é ${formatBRL(pr.precoMinimo)}.` };

  const resultados: PublicarVariasContasResultado[] = [];
  for (const mlContaId of mlContaIds) {
    const donoErro = await checarDonoDaContaMl(ctx.db, ctx.clienteId, mlContaId);
    if (donoErro) {
      resultados.push({ mlContaId, ok: false, error: donoErro });
      continue;
    }
    const res = await publicarAnuncioMLDrop(ctx.clienteId, mlContaId, pr.produto, precoRevenda, ctx.metodosEnvio);
    resultados.push({
      mlContaId,
      ok: res.ok,
      error: res.ok ? undefined : res.error,
      permalink: res.ok ? res.permalink : undefined,
    });
  }
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true, resultados };
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
    const pr = await buscarProdutoElegivel(dropDb, item.produtoId, ctx.clienteId);
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
    const res = await publicarAnuncioMLDrop(ctx.clienteId, mlContaId, pr.produto, item.precoRevenda, ctx.metodosEnvio);
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

  const pr = await buscarProdutoElegivel(dropDb, produtoId, ctx.clienteId);
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

/** Fecha o anúncio simples no ML (definitivo — não dá pra reabrir) e apaga o
 *  vínculo local, liberando a conta pra publicar de novo do zero. */
export async function excluirAnuncioML(portalToken: string, mlContaId: string, produtoId: string): Promise<ActionResult> {
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

  const res = await atualizarAnuncioMLDrop(mlContaId, produtoId, anuncio.ml_item_id as string, { status: "closed" });
  if (!res.ok) return { ok: false, error: res.error };
  await dropDb.from("seller_ml_anuncios").delete().eq("cliente_id", ctx.clienteId).eq("ml_conta_id", mlContaId).eq("produto_id", produtoId);
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true };
}
