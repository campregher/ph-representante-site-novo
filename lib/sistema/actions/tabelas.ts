"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile, canManage } from "@/lib/sistema/auth";
import { tabelaSchema } from "@/lib/sistema/schemas";
import type { ActionResult } from "@/lib/sistema/types";

async function guard() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (!canManage(profile.role))
    return { profile: null, error: "Seu papel não permite gerenciar tabelas." as const };
  return { profile, error: null };
}

export async function saveTabela(id: string | null, raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };

  const parsed = tabelaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;
  const supabase = await createSistemaClient();
  const payload = { ...v, updated_by: g.profile!.id };

  if (id) {
    const { error } = await supabase.from("tabelas_preco").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/sistema/tabelas");
    revalidatePath(`/sistema/tabelas/${id}`);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("tabelas_preco")
    .insert({ ...payload, created_by: g.profile!.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/tabelas");
  return { ok: true, id: data.id as string };
}

export async function toggleTabelaAtiva(id: string, ativa: boolean): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase
    .from("tabelas_preco")
    .update({ ativa, updated_by: g.profile!.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/tabelas");
  revalidatePath(`/sistema/tabelas/${id}`);
  return { ok: true, id };
}

export async function deleteTabela(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("tabelas_preco").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/tabelas");
  return { ok: true };
}

export interface PrecoRowInput {
  produto_id: string;
  preco: number | null;
  preco_minimo: number | null;
  desconto_maximo: number | null;
}

export async function upsertPrecos(
  tabelaId: string,
  rows: PrecoRowInput[]
): Promise<ActionResult<{ salvos?: number; removidos?: number }>> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();

  const upserts = rows
    .filter((r) => r.preco != null && Number.isFinite(r.preco))
    .map((r) => ({
      produto_id: r.produto_id,
      tabela_preco_id: tabelaId,
      preco: Number(r.preco),
      preco_minimo: r.preco_minimo != null && Number.isFinite(r.preco_minimo) ? Number(r.preco_minimo) : null,
      desconto_maximo:
        r.desconto_maximo != null && Number.isFinite(r.desconto_maximo) ? Number(r.desconto_maximo) : null,
    }));

  const removeIds = rows.filter((r) => r.preco == null).map((r) => r.produto_id);

  if (upserts.length) {
    const { error } = await supabase
      .from("produtos_precos")
      .upsert(upserts, { onConflict: "produto_id,tabela_preco_id" });
    if (error) return { ok: false, error: error.message };
  }
  if (removeIds.length) {
    const { error } = await supabase
      .from("produtos_precos")
      .delete()
      .eq("tabela_preco_id", tabelaId)
      .in("produto_id", removeIds);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/sistema/tabelas/${tabelaId}`);
  revalidatePath("/sistema/produtos");
  return { ok: true, salvos: upserts.length, removidos: removeIds.length };
}
