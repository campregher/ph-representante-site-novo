"use server";

import { revalidatePath } from "next/cache";
import { createDropshippingClient, createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { dropFornecedorSchema, dropProdutoSchema } from "@/lib/sistema/schemas";
import { dropTabelaIds } from "@/lib/sistema/dropshipping";
import { onlyDigits } from "@/lib/sistema/format";
import type { ActionResult } from "@/lib/sistema/types";

async function guard() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (!canManage(profile.role))
    return { profile: null, error: "Apenas admin/gerente podem gerenciar o dropshipping." as const };
  return { profile, error: null };
}

// ─────────────────────────────── Fornecedores ─────────────────────────────

export async function salvarDropFornecedor(id: string | null, raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const parsed = dropFornecedorSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const v = parsed.data;
  const row = { ...v, cnpj: v.cnpj ? onlyDigits(v.cnpj) : null };
  const db = await createDropshippingClient();
  if (id) {
    const { error } = await db.from("fornecedores").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await db.from("fornecedores").insert({ ...row, created_by: g.profile!.id });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/sistema/dropshipping/fornecedores");
  return { ok: true };
}

export interface ImportarRepresentadasResultado {
  criados: number;
  ignorados: number;
}

/**
 * Puxa as representadas já cadastradas no sistema (comercial.representadas)
 * marcadas com modalidade "dropshipping" pra dentro de dropshipping.fornecedores
 * — evita recadastrar manualmente fornecedor que a PH já tem relação comercial.
 * Ignora (não duplica) quem já existe em dropshipping.fornecedores por CNPJ.
 */
export async function importarFornecedoresRepresentadas(): Promise<ActionResult<ImportarRepresentadasResultado>> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };

  const comercial = await createSistemaClient();
  const { data: representadas, error: repErro } = await comercial
    .from("representadas")
    .select("nome_fantasia, razao_social, cnpj, whatsapp, telefone, email")
    .eq("ativa", true)
    .contains("modalidades", ["dropshipping"]);
  if (repErro) return { ok: false, error: repErro.message };
  if (!representadas || representadas.length === 0) {
    return { ok: false, error: "Nenhuma representada com modalidade dropshipping encontrada." };
  }

  const db = await createDropshippingClient();
  const { data: existentes } = await db.from("fornecedores").select("cnpj");
  const cnpjsExistentes = new Set((existentes ?? []).map((f) => onlyDigits((f.cnpj as string) ?? "")).filter(Boolean));

  let criados = 0;
  let ignorados = 0;
  for (const r of representadas) {
    const cnpj = r.cnpj ? onlyDigits(r.cnpj as string) : null;
    if (cnpj && cnpjsExistentes.has(cnpj)) { ignorados++; continue; }
    const { error } = await db.from("fornecedores").insert({
      nome: (r.nome_fantasia as string) || (r.razao_social as string),
      razao_social: r.razao_social,
      cnpj,
      whatsapp: r.whatsapp,
      telefone: r.telefone,
      email: r.email,
      created_by: g.profile!.id,
    });
    if (error) { ignorados++; continue; }
    if (cnpj) cnpjsExistentes.add(cnpj);
    criados++;
  }

  revalidatePath("/sistema/dropshipping/fornecedores");
  return { ok: true, criados, ignorados };
}

export async function excluirDropFornecedor(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const db = await createDropshippingClient();
  const { error } = await db.from("fornecedores").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/dropshipping/fornecedores");
  return { ok: true };
}

// ──────────────────────────────── Produtos ─────────────────────────────────

export async function salvarDropProduto(id: string | null, raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const parsed = dropProdutoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const v = parsed.data;
  const db = await createDropshippingClient();

  const row = {
    sku: v.sku,
    nome: v.nome,
    descricao: v.descricao,
    imagem_url: v.imagens[0] || v.imagem_url || null,
    imagens: v.imagens,
    ml_category_id: v.ml_category_id || null,
    ml_category_nome: v.ml_category_nome || null,
    marca: v.marca,
    categoria_interna: v.categoria_interna || null,
    transporte_aceito: v.transporte_aceito,
    fornecedor_id: v.fornecedor_id || null,
    estoque_atual: Math.round(Number(v.estoque_atual ?? 0)),
    estoque_minimo: Math.round(Number(v.estoque_minimo ?? 0)),
    ativo: v.ativo,
  };

  let produtoId = id;
  if (produtoId) {
    const { error } = await db.from("produtos").update(row).eq("id", produtoId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await db
      .from("produtos")
      .insert({ ...row, created_by: g.profile!.id })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    produtoId = data.id as string;
  }

  const tabelas = await dropTabelaIds();
  if (tabelas.cnpj) {
    const { error } = await db.from("produto_precos").upsert(
      { produto_id: produtoId, tabela_preco_id: tabelas.cnpj, custo: v.custoCnpj ?? 0, preco_sugerido: v.precoSugeridoCnpj ?? null },
      { onConflict: "produto_id,tabela_preco_id" }
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/sistema/dropshipping/produtos");
  return { ok: true };
}

export async function excluirDropProduto(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const db = await createDropshippingClient();
  const { error } = await db.from("produtos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/dropshipping/produtos");
  return { ok: true };
}

export interface PatchDropProdutosEmMassa {
  categoria_interna?: string;
  transporte_aceito?: string[];
  ml_category_id?: string;
  ml_category_nome?: string;
}

/** Aplica o mesmo patch (categoria interna, transporte aceito e/ou categoria
 *  do ML) pra vários produtos de uma vez — evita abrir um por um pra
 *  classificar uma importação grande. */
export async function salvarDropProdutosEmMassa(
  produtoIds: string[],
  patch: PatchDropProdutosEmMassa
): Promise<ActionResult<{ atualizados: number }>> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  if (produtoIds.length === 0) return { ok: false, error: "Nenhum produto selecionado." };
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nenhuma alteração pra aplicar." };

  const db = await createDropshippingClient();
  const { error } = await db.from("produtos").update(patch).in("id", produtoIds);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sistema/dropshipping/produtos");
  return { ok: true, atualizados: produtoIds.length };
}

// ──────────────────────── Importação via CSV ───────────────────────────────

/**
 * Parser de CSV simples (vírgula, aspas opcionais, sem libs externas).
 * Tokeniza o texto inteiro num passe só (não quebra por linha antes de ler
 * aspas) — assim um campo entre aspas com quebra de linha de verdade (ex.:
 * descrição de produto em várias linhas) não vira várias linhas erradas.
 */
function parseCsv(texto: string): Record<string, string>[] {
  const linhasDeCamposos: string[][] = [];
  let linhaAtual: string[] = [];
  let campoAtual = "";
  let dentroAspas = false;
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];
    if (dentroAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campoAtual += '"'; i += 2; continue; }
        dentroAspas = false;
        i++;
        continue;
      }
      campoAtual += c;
      i++;
      continue;
    }
    if (c === '"') { dentroAspas = true; i++; continue; }
    if (c === ",") { linhaAtual.push(campoAtual.trim()); campoAtual = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") {
      linhaAtual.push(campoAtual.trim());
      campoAtual = "";
      if (linhaAtual.some((v) => v !== "")) linhasDeCamposos.push(linhaAtual);
      linhaAtual = [];
      i++;
      continue;
    }
    campoAtual += c;
    i++;
  }
  linhaAtual.push(campoAtual.trim());
  if (linhaAtual.some((v) => v !== "")) linhasDeCamposos.push(linhaAtual);

  if (linhasDeCamposos.length < 2) return [];
  const cabecalho = linhasDeCamposos[0].map((h) => h.toLowerCase());
  return linhasDeCamposos.slice(1).map((valores) => {
    const row: Record<string, string> = {};
    cabecalho.forEach((h, idx) => { row[h] = valores[idx] ?? ""; });
    return row;
  });
}

function numOrNull(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export interface ImportarFornecedorResultado {
  fornecedoresCriados: number;
  produtosCriados: number;
  erros: string[];
}

/**
 * Importa fornecedor(es) por CSV. Modo "cadastro": só cria fornecedores
 * (colunas: nome, razao_social, cnpj, telefone, whatsapp, email). Modo
 * "cadastro_produtos": cada linha é um produto, com o fornecedor
 * identificado pelo nome (cria o fornecedor se não existir) — colunas:
 * fornecedor, sku, nome, descricao, marca, imagens (várias URLs
 * separadas por ";" — a primeira vira a capa), estoque_atual,
 * custo_cnpj, preco_sugerido_cnpj.
 */
export async function importarDropFornecedorCsv(
  modo: "cadastro" | "cadastro_produtos",
  csvText: string
): Promise<ActionResult<ImportarFornecedorResultado>> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const db = await createDropshippingClient();
  const linhas = parseCsv(csvText);
  if (linhas.length === 0) return { ok: false, error: "CSV vazio ou sem linhas de dados." };

  const resultado: ImportarFornecedorResultado = { fornecedoresCriados: 0, produtosCriados: 0, erros: [] };
  const fornecedorIdPorNome = new Map<string, string>();

  async function fornecedorId(nome: string): Promise<string | null> {
    const chave = nome.trim().toLowerCase();
    if (!chave) return null;
    if (fornecedorIdPorNome.has(chave)) return fornecedorIdPorNome.get(chave)!;
    const { data: existente } = await db.from("fornecedores").select("id").ilike("nome", nome.trim()).maybeSingle();
    if (existente) {
      fornecedorIdPorNome.set(chave, existente.id as string);
      return existente.id as string;
    }
    const { data: novo, error } = await db
      .from("fornecedores")
      .insert({ nome: nome.trim(), created_by: g.profile!.id })
      .select("id")
      .single();
    if (error || !novo) return null;
    resultado.fornecedoresCriados++;
    fornecedorIdPorNome.set(chave, novo.id as string);
    return novo.id as string;
  }

  if (modo === "cadastro") {
    for (const [i, row] of linhas.entries()) {
      const nome = row.nome;
      if (!nome) { resultado.erros.push(`Linha ${i + 2}: coluna "nome" vazia.`); continue; }
      const { data: existente } = await db.from("fornecedores").select("id").ilike("nome", nome).maybeSingle();
      if (existente) { resultado.erros.push(`Linha ${i + 2}: fornecedor "${nome}" já existe — ignorado.`); continue; }
      const { error } = await db.from("fornecedores").insert({
        nome,
        razao_social: row.razao_social || null,
        cnpj: row.cnpj ? onlyDigits(row.cnpj) : null,
        telefone: row.telefone || null,
        whatsapp: row.whatsapp || null,
        email: row.email || null,
        created_by: g.profile!.id,
      });
      if (error) resultado.erros.push(`Linha ${i + 2}: ${error.message}`);
      else resultado.fornecedoresCriados++;
    }
    revalidatePath("/sistema/dropshipping/fornecedores");
    return { ok: true, ...resultado };
  }

  // modo "cadastro_produtos"
  const tabelas = await dropTabelaIds();
  for (const [i, row] of linhas.entries()) {
    const nomeFornecedor = row.fornecedor;
    const sku = row.sku;
    const nome = row.nome;
    if (!nomeFornecedor || !sku || !nome) {
      resultado.erros.push(`Linha ${i + 2}: "fornecedor", "sku" e "nome" são obrigatórios.`);
      continue;
    }
    const fid = await fornecedorId(nomeFornecedor);
    if (!fid) { resultado.erros.push(`Linha ${i + 2}: não consegui criar/achar o fornecedor "${nomeFornecedor}".`); continue; }

    // produtos.sku tem índice único por lower(sku) (expressão) — o upsert do
    // PostgREST com onConflict só mira índice/constraint de coluna literal,
    // não expressão, então faz sempre select-then-insert-or-update à mão.
    const imagens = (row.imagens || row.imagem_url || "")
      .split(";")
      .map((u) => u.trim())
      .filter(Boolean);
    const produtoRow = {
      sku,
      nome,
      descricao: row.descricao || null,
      marca: row.marca || null,
      imagem_url: imagens[0] || null,
      imagens,
      fornecedor_id: fid,
      estoque_atual: Math.round(numOrNull(row.estoque_atual) ?? 0),
    };
    const { data: existente } = await db.from("produtos").select("id").ilike("sku", sku).maybeSingle();
    let produto: { id: string } | null = null;
    let prodErr: { message: string } | null = null;
    if (existente) {
      const { error } = await db.from("produtos").update(produtoRow).eq("id", existente.id as string);
      prodErr = error;
      produto = error ? null : { id: existente.id as string };
    } else {
      const { data, error } = await db
        .from("produtos")
        .insert({ ...produtoRow, created_by: g.profile!.id })
        .select("id")
        .single();
      prodErr = error;
      produto = data ? { id: data.id as string } : null;
    }
    if (prodErr || !produto) { resultado.erros.push(`Linha ${i + 2}: ${prodErr?.message ?? "erro ao salvar produto"}`); continue; }

    if (tabelas.cnpj) {
      await db.from("produto_precos").upsert(
        {
          produto_id: produto.id as string,
          tabela_preco_id: tabelas.cnpj,
          custo: numOrNull(row.custo_cnpj) ?? 0,
          preco_sugerido: numOrNull(row.preco_sugerido_cnpj),
        },
        { onConflict: "produto_id,tabela_preco_id" }
      );
    }
    resultado.produtosCriados++;
  }

  revalidatePath("/sistema/dropshipping/fornecedores");
  revalidatePath("/sistema/dropshipping/produtos");
  return { ok: true, ...resultado };
}
