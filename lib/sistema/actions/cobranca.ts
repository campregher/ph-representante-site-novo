"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { canFinance } from "@/lib/sistema/roles";
import { contaReceberSchema, marcarPagoSchema } from "@/lib/sistema/schemas";
import type { ActionResult } from "@/lib/sistema/types";

async function guardFinance() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (!canFinance(profile.role))
    return { profile: null, error: "Apenas Financeiro/Gerente/Admin." as const };
  return { profile, error: null };
}

export async function criarContaAvulsa(raw: unknown): Promise<ActionResult> {
  const g = await guardFinance();
  if (g.error) return { ok: false, error: g.error };
  const parsed = contaReceberSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const v = parsed.data;
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("contas_receber").insert({
    cliente_id: v.cliente_id || null,
    pedido_id: v.pedido_id || null,
    descricao: v.descricao,
    valor: v.valor,
    vencimento: v.vencimento || null,
    forma: v.forma || null,
    observacoes: v.observacoes,
    status: "aberto",
    created_by: g.profile!.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/cobranca");
  return { ok: true };
}

export async function marcarContaPaga(raw: unknown): Promise<ActionResult> {
  const g = await guardFinance();
  if (g.error) return { ok: false, error: g.error };
  const parsed = marcarPagoSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { id, valor_pago, pago_em, forma } = parsed.data;
  const supabase = await createSistemaClient();
  const patch: Record<string, unknown> = {
    status: "pago",
    pago_em: pago_em || new Date().toISOString().slice(0, 10),
  };
  if (valor_pago != null) patch.valor_pago = valor_pago;
  if (forma) patch.forma = forma;
  const { error } = await supabase.from("contas_receber").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/cobranca");
  return { ok: true };
}

export async function reabrirConta(id: string): Promise<ActionResult> {
  const g = await guardFinance();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase
    .from("contas_receber")
    .update({ status: "aberto", valor_pago: null, pago_em: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/cobranca");
  return { ok: true };
}

export async function cancelarConta(id: string): Promise<ActionResult> {
  const g = await guardFinance();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("contas_receber").update({ status: "cancelado" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/cobranca");
  return { ok: true };
}
