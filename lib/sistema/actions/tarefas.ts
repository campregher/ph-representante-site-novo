"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { tarefaSchema } from "@/lib/sistema/schemas";
import type { ActionResult } from "@/lib/sistema/types";

async function guard() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (profile.role === "consulta")
    return { profile: null, error: "Seu papel é somente leitura." as const };
  return { profile, error: null };
}

export async function salvarTarefa(id: string | null, raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };

  const parsed = tarefaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;
  const row = {
    titulo: v.titulo,
    descricao: v.descricao,
    tipo: v.tipo,
    cliente_id: v.cliente_id || null,
    representada_id: v.representada_id || null,
    pedido_id: v.pedido_id || null,
    responsavel_id: v.responsavel_id || g.profile!.id,
    data_prevista: v.data_prevista || null,
    prioridade: v.prioridade,
    status: v.status,
  };

  const supabase = await createSistemaClient();
  if (id) {
    const { error } = await supabase.from("tarefas").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("tarefas").insert(row);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/sistema/tarefas");
  return { ok: true };
}

export async function alterarStatusTarefa(
  id: string,
  status: "pendente" | "em_andamento" | "concluida" | "cancelada"
): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("tarefas").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/tarefas");
  return { ok: true };
}

export async function excluirTarefa(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("tarefas").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/tarefas");
  return { ok: true };
}
