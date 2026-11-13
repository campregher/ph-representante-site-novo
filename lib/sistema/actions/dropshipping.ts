"use server";

import { revalidatePath } from "next/cache";
import { createDropshippingClient } from "@/lib/supabase/server";
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
    imagem_url: v.imagem_url,
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
  const precos = [
    { tabela_preco_id: tabelas.cpf, custo: v.custoCpf ?? 0, preco_sugerido: v.precoSugeridoCpf ?? null },
    { tabela_preco_id: tabelas.cnpj, custo: v.custoCnpj ?? 0, preco_sugerido: v.precoSugeridoCnpj ?? null },
  ].filter((p) => p.tabela_preco_id);

  for (const p of precos) {
    const { error } = await db
      .from("produto_precos")
      .upsert({ produto_id: produtoId, ...p }, { onConflict: "produto_id,tabela_preco_id" });
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

// ──────────────────────── Importação via CSV ───────────────────────────────

/** Parser de CSV simples (vírgula, aspas opcionais, sem libs externas). */
function parseCsv(texto: string): Record<string, string>[] {
  const linhas = texto.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return [];
  const splitLinha = (linha: string): string[] => {
    const campos: string[] = [];
    let atual = "";
    let dentroAspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (dentroAspas && linha[i + 1] === '"') { atual += '"'; i++; }
        else dentroAspas = !dentroAspas;
      } else if (c === "," && !dentroAspas) {
        campos.push(atual.trim());
        atual = "";
      } else {
        atual += c;
      }
    }
    campos.push(atual.trim());
    return campos;
  };
  const cabecalho = splitLinha(linhas[0]).map((h) => h.toLowerCase());
  return linhas.slice(1).map((linha) => {
    const valores = splitLinha(linha);
    const row: Record<string, string> = {};
    cabecalho.forEach((h, i) => { row[h] = (valores[i] ?? "").trim(); });
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
 * fornecedor, sku, nome, descricao, estoque_atual, custo_cpf,
 * preco_sugerido_cpf, custo_cnpj, preco_sugerido_cnpj.
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

    const { data: produto, error: prodErr } = await db
      .from("produtos")
      .upsert(
        {
          sku,
          nome,
          descricao: row.descricao || null,
          fornecedor_id: fid,
          estoque_atual: Math.round(numOrNull(row.estoque_atual) ?? 0),
          created_by: g.profile!.id,
        },
        { onConflict: "sku" }
      )
      .select("id")
      .single();
    if (prodErr || !produto) { resultado.erros.push(`Linha ${i + 2}: ${prodErr?.message ?? "erro ao salvar produto"}`); continue; }

    const precos = [
      { tabela_preco_id: tabelas.cpf, custo: numOrNull(row.custo_cpf) ?? 0, preco_sugerido: numOrNull(row.preco_sugerido_cpf) },
      { tabela_preco_id: tabelas.cnpj, custo: numOrNull(row.custo_cnpj) ?? 0, preco_sugerido: numOrNull(row.preco_sugerido_cnpj) },
    ].filter((p) => p.tabela_preco_id);
    for (const p of precos) {
      await db.from("produto_precos").upsert(
        { produto_id: produto.id as string, ...p },
        { onConflict: "produto_id,tabela_preco_id" }
      );
    }
    resultado.produtosCriados++;
  }

  revalidatePath("/sistema/dropshipping/fornecedores");
  revalidatePath("/sistema/dropshipping/produtos");
  return { ok: true, ...resultado };
}
