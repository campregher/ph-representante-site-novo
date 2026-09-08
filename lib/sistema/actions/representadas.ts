"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile, canManage } from "@/lib/sistema/auth";
import { representadaSchema } from "@/lib/sistema/schemas";
import { onlyDigits } from "@/lib/sistema/format";
import type { ActionResult } from "@/lib/sistema/types";

async function guard() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (!canManage(profile.role))
    return { profile: null, error: "Seu papel não permite gerenciar representadas." as const };
  return { profile, error: null };
}

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Já existe uma representada com este CNPJ.";
  return error.message;
}

export async function saveRepresentada(
  id: string | null,
  raw: unknown
): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };

  const parsed = representadaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;
  const supabase = await createSistemaClient();

  const fazDropship = v.modalidades.includes("dropshipping");
  const payload = {
    ...v,
    cnpj: v.cnpj ? onlyDigits(v.cnpj) : null,
    dropship_faturamento: fazDropship ? v.dropship_faturamento : null,
    dropship_condicoes_pagamento: fazDropship ? v.dropship_condicoes_pagamento : [],
    dropship_observacoes: fazDropship ? v.dropship_observacoes : null,
    updated_by: g.profile!.id,
  };

  if (id) {
    const { error } = await supabase.from("representadas").update(payload).eq("id", id);
    if (error) return { ok: false, error: friendly(error) };
    revalidatePath("/sistema/representadas");
    revalidatePath(`/sistema/representadas/${id}`);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("representadas")
    .insert({ ...payload, created_by: g.profile!.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath("/sistema/representadas");
  return { ok: true, id: data.id as string };
}

export async function toggleRepresentadaAtiva(
  id: string,
  ativa: boolean
): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase
    .from("representadas")
    .update({ ativa, updated_by: g.profile!.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/representadas");
  revalidatePath(`/sistema/representadas/${id}`);
  return { ok: true, id };
}

export async function deleteRepresentada(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("representadas").delete().eq("id", id);
  if (error) {
    if (error.code === "23503")
      return {
        ok: false,
        error: "Não é possível excluir: há produtos, tabelas ou pedidos vinculados. Inative-a.",
      };
    return { ok: false, error: error.message };
  }
  revalidatePath("/sistema/representadas");
  return { ok: true };
}
