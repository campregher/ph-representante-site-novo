"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile, canManage } from "@/lib/sistema/auth";
import {
  produtoSchema,
  categoriaSchema,
  salvarVariacoesSchema,
} from "@/lib/sistema/schemas";
import type { ActionResult, VariacaoEixo } from "@/lib/sistema/types";

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
  // As variações têm ciclo próprio (salvarVariacoes) — não gravamos aqui.
  const { tem_variacoes: _tv, variacao_eixos: _ve, ...campos } = parsed.data;
  void _tv;
  void _ve;
  const supabase = await createSistemaClient();
  const payload = { ...campos, sku: campos.sku.trim(), updated_by: g.profile!.id };

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

// ─────────────────────────── Variações ────────────────────────────
// Grava os eixos no produto pai e substitui todo o conjunto de
// variações (delete + insert). `pedido_itens.variacao_id` tem
// ON DELETE SET NULL e o snapshot preserva o histórico do pedido.

export async function salvarVariacoes(raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };

  const parsed = salvarVariacoesSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { produto_id, eixos, variacoes } = parsed.data;
  const supabase = await createSistemaClient();

  const { data: prod } = await supabase
    .from("produtos")
    .select("id")
    .eq("id", produto_id)
    .maybeSingle();
  if (!prod) return { ok: false, error: "Produto não encontrado." };

  // SKUs de variação não podem repetir dentro do mesmo produto
  const skus = variacoes.map((x) => x.sku.trim().toLowerCase());
  const repetido = skus.find((s, i) => skus.indexOf(s) !== i);
  if (repetido) {
    return { ok: false, error: `SKU de variação repetido: "${repetido}".` };
  }

  const { error: eProd } = await supabase
    .from("produtos")
    .update({
      tem_variacoes: variacoes.length > 0,
      variacao_eixos: eixos,
      updated_by: g.profile!.id,
    })
    .eq("id", produto_id);
  if (eProd) return { ok: false, error: eProd.message };

  const { error: eDel } = await supabase
    .from("produto_variacoes")
    .delete()
    .eq("produto_id", produto_id);
  if (eDel) return { ok: false, error: eDel.message };

  if (variacoes.length) {
    const rows = variacoes.map((x, i) => ({
      produto_id,
      sku: x.sku.trim(),
      atributos: x.atributos ?? {},
      preco_bruto: x.preco_bruto ?? null,
      codigo_fabrica: x.codigo_fabrica ?? null,
      ean: x.ean ?? null,
      imagem_url: x.imagem_url ?? null,
      peso: x.peso ?? null,
      ativo: x.ativo ?? true,
      ordem: typeof x.ordem === "number" ? x.ordem : i,
      observacoes: x.observacoes ?? null,
      created_by: g.profile!.id,
      updated_by: g.profile!.id,
    }));
    const { error: eIns } = await supabase.from("produto_variacoes").insert(rows);
    if (eIns) return { ok: false, error: friendly(eIns) };
  }

  revalidatePath("/sistema/produtos");
  revalidatePath(`/sistema/produtos/${produto_id}`);
  return { ok: true, id: produto_id };
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
  /** SKU do produto pai — quando presente e ≠ do próprio SKU, a linha é uma variação */
  sku_pai?: string;
  /** eixos da variação: [{nome:"Estofado", valor:"Couro"}, ...] */
  variacao_eixos?: { nome: string; valor: string }[];
}

export interface ImportResumo {
  criados: number;
  atualizados: number;
  categoriasCriadas: number;
  ignorados: number;
  erros: number;
  variacoesCriadas: number;
  variacoesAtualizadas: number;
}

/** une os eixos já gravados no pai com os desta remessa (nomes/valores distintos). */
function mergeEixos(atuais: VariacaoEixo[], grupo: ImportRow[]): VariacaoEixo[] {
  const map = new Map<string, string[]>();
  const ordem: string[] = [];
  for (const e of atuais) {
    map.set(e.nome, [...(e.valores ?? [])]);
    ordem.push(e.nome);
  }
  for (const r of grupo) {
    for (const e of r.variacao_eixos ?? []) {
      const nome = String(e.nome ?? "").trim();
      const valor = String(e.valor ?? "").trim();
      if (!nome || !valor) continue;
      if (!map.has(nome)) {
        map.set(nome, []);
        ordem.push(nome);
      }
      const arr = map.get(nome)!;
      if (!arr.includes(valor)) arr.push(valor);
    }
  }
  return ordem.map((nome) => ({ nome, valores: map.get(nome) ?? [] }));
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

  // linha é variação quando tem SKU pai informado e diferente do próprio SKU
  const isVariante = (r: ImportRow) => {
    const pai = String(r.sku_pai ?? "").trim();
    return !!pai && pai.toLowerCase() !== r.sku.toLowerCase();
  };
  const standaloneRows = rows.filter((r) => !isVariante(r));
  const varianteRows = rows.filter(isVariante);

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
    variacoesCriadas: 0,
    variacoesAtualizadas: 0,
  };

  const catId = (r: ImportRow) => {
    const n = String(r.categoria ?? "").trim().toLowerCase();
    return n ? catByNome.get(n) : undefined;
  };

  const novos = standaloneRows.filter((r) => !bySku.has(r.sku.toLowerCase()));
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

  for (const r of standaloneRows) {
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

  // ── variações ──────────────────────────────────────────────────
  if (varianteRows.length) {
    // recarrega os produtos (o passo acima pode ter criado o pai)
    const { data: prodAll } = await supabase
      .from("produtos")
      .select("id, sku, variacao_eixos")
      .eq("representada_id", representadaId);
    const paiBySku = new Map<string, { id: string; eixos: VariacaoEixo[] }>();
    for (const p of prodAll ?? [])
      paiBySku.set(String(p.sku).toLowerCase(), {
        id: p.id as string,
        eixos: Array.isArray(p.variacao_eixos) ? (p.variacao_eixos as VariacaoEixo[]) : [],
      });

    const grupos = new Map<string, ImportRow[]>();
    for (const r of varianteRows) {
      const k = String(r.sku_pai).trim().toLowerCase();
      const g2 = grupos.get(k);
      if (g2) g2.push(r);
      else grupos.set(k, [r]);
    }

    for (const [skuKey, grupo] of grupos) {
      const skuPai = String(grupo[0].sku_pai).trim();
      let pai = paiBySku.get(skuKey);

      if (!pai) {
        if (!options.criarNovos) {
          resumo.ignorados += grupo.length;
          continue;
        }
        const { data: novoPai, error: ePai } = await supabase
          .from("produtos")
          .insert({
            representada_id: representadaId,
            sku: skuPai,
            nome: String(grupo[0].nome ?? "").trim() || skuPai,
            categoria_id: catId(grupo[0]) ?? null,
            tem_variacoes: true,
            created_by: g.profile!.id,
          })
          .select("id, variacao_eixos")
          .single();
        if (ePai || !novoPai) {
          resumo.erros += grupo.length;
          continue;
        }
        pai = { id: novoPai.id as string, eixos: [] };
        paiBySku.set(skuKey, pai);
        resumo.criados++;
      }

      const eixos = mergeEixos(pai.eixos, grupo);
      await supabase
        .from("produtos")
        .update({ tem_variacoes: true, variacao_eixos: eixos, updated_by: g.profile!.id })
        .eq("id", pai.id);
      pai.eixos = eixos;

      const { data: varsExist } = await supabase
        .from("produto_variacoes")
        .select("id, sku")
        .eq("produto_id", pai.id);
      const varBySku = new Map<string, string>();
      for (const x of varsExist ?? []) varBySku.set(String(x.sku).toLowerCase(), x.id as string);

      const toInsert: Record<string, unknown>[] = [];
      for (const r of grupo) {
        const atributos: Record<string, string> = {};
        for (const e of r.variacao_eixos ?? []) {
          const nome = String(e.nome ?? "").trim();
          const valor = String(e.valor ?? "").trim();
          if (nome && valor) atributos[nome] = valor;
        }
        const campos = {
          sku: r.sku,
          atributos,
          preco_bruto:
            r.preco_bruto != null && Number.isFinite(r.preco_bruto) ? r.preco_bruto : null,
          codigo_fabrica: r.codigo_fabrica?.trim() || null,
          ean: r.ean?.trim() || null,
          imagem_url: r.imagem_url?.trim() || null,
          peso: r.peso != null && Number.isFinite(r.peso) ? r.peso : null,
          ativo: parseAtivo(r.ativo) ?? true,
        };
        const existId = varBySku.get(r.sku.toLowerCase());
        if (existId) {
          if (options.ignorarDuplicados || !options.atualizarDados) {
            resumo.ignorados++;
            continue;
          }
          const { error } = await supabase
            .from("produto_variacoes")
            .update({ ...campos, updated_by: g.profile!.id })
            .eq("id", existId);
          if (error) resumo.erros++;
          else resumo.variacoesAtualizadas++;
        } else {
          if (!options.criarNovos) {
            resumo.ignorados++;
            continue;
          }
          toInsert.push({ produto_id: pai.id, ...campos, created_by: g.profile!.id });
        }
      }
      if (toInsert.length) {
        const { error } = await supabase.from("produto_variacoes").insert(toInsert);
        if (error) resumo.erros += toInsert.length;
        else resumo.variacoesCriadas += toInsert.length;
      }
    }
  }

  revalidatePath("/sistema/produtos");
  return { ok: true, resumo };
}
