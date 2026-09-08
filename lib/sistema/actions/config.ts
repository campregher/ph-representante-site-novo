"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { meuPerfilSchema, empresaConfigSchema } from "@/lib/sistema/schemas";
import { onlyDigits } from "@/lib/sistema/format";
import type { ActionResult } from "@/lib/sistema/types";

export async function saveMeuPerfil(raw: unknown): Promise<ActionResult> {
  const profile = await getSistemaProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };
  const parsed = meuPerfilSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const supabase = await createSistemaClient();
  const { error } = await supabase
    .from("profiles")
    .update({ nome: parsed.data.nome, telefone: parsed.data.telefone })
    .eq("id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/configuracoes");
  revalidatePath("/sistema", "layout");
  return { ok: true };
}

export async function saveEmpresaConfig(raw: unknown): Promise<ActionResult> {
  const profile = await getSistemaProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };
  if (profile.role !== "admin")
    return { ok: false, error: "Apenas administradores podem editar os dados da empresa." };

  const parsed = empresaConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("config").upsert({
    id: "default",
    ...v,
    whatsapp: v.whatsapp ? onlyDigits(v.whatsapp) : null,
    cnpj: v.cnpj ? onlyDigits(v.cnpj) : null,
    updated_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/configuracoes");
  return { ok: true };
}
