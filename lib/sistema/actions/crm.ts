"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { oportunidadeSchema } from "@/lib/sistema/schemas";
import type { ActionResult } from "@/lib/sistema/types";

const ETAPAS = [
  "prospect",
  "primeiro_contato",
  "apresentacao",
  "tabela_enviada",
  "negociacao",
  "primeiro_pedido",
  "cliente_ativo",
  "perdido",
];

async function guard() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (profile.role === "consulta")
    return { profile: null, error: "Seu papel é somente leitura." as const };
  return { profile, error: null };
}

export async function salvarOportunidade(id: string | null, raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };

  const parsed = oportunidadeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;
  const row = {
    cliente_id: v.cliente_id,
    responsavel_id: v.responsavel_id || g.profile!.id,
    etapa: v.etapa,
    representada_id: v.representada_id || null,
    valor_estimado: v.valor_estimado ?? 0,
    proxima_acao: v.proxima_acao,
    data_proxima_acao: v.data_proxima_acao || null,
    observacoes: v.observacoes,
  };

  const supabase = await createSistemaClient();
  if (id) {
    const { error } = await supabase.from("crm_oportunidades").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("crm_oportunidades").insert(row);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/sistema/crm");
  return { ok: true };
}

export async function moverEtapa(id: string, etapa: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  if (!ETAPAS.includes(etapa)) return { ok: false, error: "Etapa inválida." };

  const supabase = await createSistemaClient();
  const { error } = await supabase.from("crm_oportunidades").update({ etapa }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/crm");
  return { ok: true };
}

export async function excluirOportunidade(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("crm_oportunidades").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/crm");
  return { ok: true };
}
