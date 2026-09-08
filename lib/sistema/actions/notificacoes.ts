"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import type { ActionResult } from "@/lib/sistema/types";

export async function marcarNotificacaoLida(id: string): Promise<ActionResult> {
  const profile = await getSistemaProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };
  const supabase = await createSistemaClient();
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida: true })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema", "layout");
  return { ok: true };
}

export async function marcarTodasLidas(): Promise<ActionResult> {
  const profile = await getSistemaProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };
  const supabase = await createSistemaClient();
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida: true })
    .eq("lida", false);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema", "layout");
  return { ok: true };
}
