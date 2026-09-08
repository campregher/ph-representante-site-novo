"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile, canManage } from "@/lib/sistema/auth";
import { produtoSchema, categoriaSchema } from "@/lib/sistema/schemas";
import type { ActionResult } from "@/lib/sistema/types";

async function guard() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (!canManage(profile.role))
    return { profile: null, error: "Seu papel não permite gerenciar produtos." as const };
  return { profile, error: null };
}

export async function saveProduto(id: string | null, raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };

  const parsed = produtoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;
  const supabase = await createSistemaClient();
  const payload = { ...v, sku: v.sku.trim(), updated_by: g.profile!.id };

  if (id) {
    const { error } = await supabase.from("produtos").update(payload).eq("id", id);
    if (error) return { ok: false, error: friendly(error) };
    revalidatePath("/sistema/produtos");
    revalidatePath(`/sistema/produtos/${id}`);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("produtos")
    .insert({ ...payload, created_by: g.profile!.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath("/sistema/produtos");
  return { ok: true, id: data.id as string };
}

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Já existe um produto com este SKU nesta representada.";
  if (error.code === "23503") return "Representada ou categoria inválida.";
  return error.message;
}

export async function toggleProdutoAtivo(id: string, ativo: boolean): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase
    .from("produtos")
    .update({ ativo, updated_by: g.profile!.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/produtos");
  revalidatePath(`/sistema/produtos/${id}`);
  return { ok: true, id };
}

export async function deleteProduto(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("produtos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/produtos");
  return { ok: true };
}

export async function createCategoria(raw: unknown): Promise<ActionResult<{ id?: string; nome?: string }>> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const parsed = categoriaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Nome da categoria inválido." };
  const supabase = await createSistemaClient();
  const { data, error } = await supabase
    .from("categorias_produtos")
    .insert(parsed.data)
    .select("id, nome")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/produtos");
  return { ok: true, id: data.id as string, nome: data.nome as string };
}

// ─────────────────────────── Importação ───────────────────────────
// Modelo: a planilha traz os dados do produto + o PREÇO BRUTO.
// As tabelas de preço (regras de desconto) são criadas no sistema.

export interface ImportOptions {
  criarNovos: boolean;
  atualizarDados: boolean;
  ignorarDuplicados: boolean;
}

export interface ImportRow {
  sku: string;
  nome?: string;
  descricao?: string;
  ncm?: string;
  codigo_fabrica?: string;
  ean?: string;
  marca?: string;
  aplicacao?: string;
  montadora?: string;
  modelo?: string;
  ano_inicio?: number | null;
  ano_fim?: number | null;
  unidade?: string;
  peso?: number | null;
  preco_bruto?: number | null;
  altura?: number | null;
  largura?: number | null;
  comprimento?: number | null;
  imagem_url?: string;
  observacoes?: string;
  categoria?: string; // nome — resolvido/criado por representada
  ativo?: string; // "sim/não/1/0/ativo/inativo"
}

export interface ImportResumo {
  criados: number;
  atualizados: number;
  categoriasCriadas: number;
  ignorados: number;
  erros: number;
}

const TEXT_FIELDS = [
  "nome",
  "descricao",
  "ncm",
  "codigo_fabrica",
  "ean",
  "marca",
  "aplicacao",
  "montadora",
  "modelo",
  "unidade",
  "observacoes",
] as const;

function parseAtivo(v?: string): boolean | undefined {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return undefined;
  if (/^(sim|s|1|ativo|true|x|yes)$/.test(s)) return true;
  if (/^(n[ãa]o|n|0|inativo|false|no)$/.test(s)) return false;
  return undefined;
}

/** campos de produto (não vazios) a partir de uma linha da planilha */
function produtoFieldsFromRow(r: ImportRow, categoriaId?: string): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  const rec = r as unknown as Record<string, unknown>;
  for (const k of TEXT_FIELDS) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) p[k] = v.trim();
  }
  if (r.imagem_url?.trim()) p.imagem_url = r.imagem_url.trim();
  for (const k of ["altura", "largura", "comprimento", "peso", "preco_bruto", "ano_inicio", "ano_fim"] as const) {
    const v = r[k];
    if (v != null && Number.isFinite(v)) p[k] = k.startsWith("ano_") ? Math.trunc(v) : v;
  }
  const at = parseAtivo(r.ativo);
  if (at !== undefined) p.ativo = at;
  if (categoriaId) p.categoria_id = categoriaId;
  return p;
}

export async function importProdutos(payload: {
  representadaId: string;
  rows: ImportRow[];
  options: ImportOptions;
}): Promise<ActionResult<{ resumo?: ImportResumo }>> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };

  const { representadaId, options } = payload;
  if (!representadaId) return { ok: false, error: "Selecione a representada." };

  const supabase = await createSistemaClient();

  const { data: rep } = await supabase
    .from("representadas")
    .select("id")
    .eq("id", representadaId)
    .maybeSingle();
  if (!rep) return { ok: false, error: "Representada não encontrada." };

  // ── categorias (por nome, cria as que faltam) ───────────────────
  let categoriasCriadas = 0;
  const catByNome = new Map<string, string>();
  const catNomes = [
    ...new Set(
      payload.rows.map((r) => String(r.categoria ?? "").trim()).filter(Boolean)
    ),
  ];
  if (catNomes.length) {
    const { data: catsRep } = await supabase
      .from("categorias_produtos")
      .select("id, nome")
      .eq("representada_id", representadaId);
    for (const c of catsRep ?? [])
      catByNome.set(String(c.nome).trim().toLowerCase(), c.id as string);
    const faltando = catNomes.filter((n) => !catByNome.has(n.toLowerCase()));
    if (faltando.length) {
      const { data: novasCats } = await supabase
        .from("categorias_produtos")
        .insert(faltando.map((nome) => ({ representada_id: representadaId, nome })))
        .select("id, nome");
      for (const c of novasCats ?? []) {
        catByNome.set(String(c.nome).trim().toLowerCase(), c.id as string);
        categoriasCriadas++;
      }
    }
  }

  const rows = [
    ...new Map(
      payload.rows
        .map((r) => ({ ...r, sku: String(r.sku ?? "").trim() }))
        .filter((r) => r.sku)
        .map((r) => [r.sku.toLowerCase(), r])
    ).values(),
  ];

  const { data: existing } = await supabase
    .from("produtos")
    .select("id, sku")
    .eq("representada_id", representadaId);
  const bySku = new Map<string, string>();
  for (const p of existing ?? []) bySku.set(String(p.sku).toLowerCase(), p.id as string);

  const resumo: ImportResumo = {
    criados: 0,
    atualizados: 0,
    categoriasCriadas,
    ignorados: 0,
    erros: 0,
  };

  const catId = (r: ImportRow) => {
    const n = String(r.categoria ?? "").trim().toLowerCase();
    return n ? catByNome.get(n) : undefined;
  };

  const novos = rows.filter((r) => !bySku.has(r.sku.toLowerCase()));
  if (options.criarNovos && novos.length) {
    const insertPayload = novos.map((r) => {
      const extra = produtoFieldsFromRow(r, catId(r));
      return {
        representada_id: representadaId,
        sku: r.sku,
        ...extra,
        nome: (extra.nome as string) || r.sku,
        created_by: g.profile!.id,
      };
    });
    const { error } = await supabase.from("produtos").insert(insertPayload);
    if (error) return { ok: false, error: error.message };
    resumo.criados = insertPayload.length;
    for (const r of novos) bySku.set(r.sku.toLowerCase(), "novo");
  } else if (!options.criarNovos) {
    resumo.ignorados += novos.length;
  }

  for (const r of rows) {
    const key = r.sku.toLowerCase();
    if (!existing?.some((p) => String(p.sku).toLowerCase() === key)) continue;
    const pid = existing.find((p) => String(p.sku).toLowerCase() === key)!.id as string;
    if (options.ignorarDuplicados) {
      resumo.ignorados++;
      continue;
    }
    if (options.atualizarDados) {
      const patch = produtoFieldsFromRow(r, catId(r));
      if (Object.keys(patch).length) {
        patch.updated_by = g.profile!.id;
        const { error } = await supabase.from("produtos").update(patch).eq("id", pid);
        if (error) resumo.erros++;
        else resumo.atualizados++;
      }
    }
  }

  revalidatePath("/sistema/produtos");
  return { ok: true, resumo };
}
