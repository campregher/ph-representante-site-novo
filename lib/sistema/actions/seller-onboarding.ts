"use server";

import { revalidatePath } from "next/cache";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { sellerOnboardingSchema } from "@/lib/sistema/schemas";
import type { ActionResult } from "@/lib/sistema/types";

type Db = Awaited<ReturnType<typeof createSistemaAdminClient>>;

async function resolveClienteLiberado(
  portalToken: string
): Promise<{ db: Db; clienteId: string } | { error: string }> {
  const db = await createSistemaAdminClient();
  const { data: cliente } = await db
    .from("clientes")
    .select("id, status, email_confirmado")
    .eq("portal_token", portalToken)
    .maybeSingle();
  if (!cliente) return { error: "Link inválido." };
  if (cliente.status === "bloqueado") return { error: "Acesso bloqueado." };
  if (!cliente.email_confirmado || cliente.status === "prospect")
    return { error: "Cadastro ainda não liberado." };
  return { db, clienteId: cliente.id as string };
}

/** Questionário pós-aprovação — direciona quais fornecedores/produtos mostrar pro seller. */
export async function salvarOnboardingSeller(portalToken: string, raw: unknown): Promise<ActionResult> {
  const ctx = await resolveClienteLiberado(portalToken);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = sellerOnboardingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const v = parsed.data;

  const { error } = await ctx.db
    .from("clientes")
    .update({
      onboarding_interesses: v.interesses,
      onboarding_ja_vende: v.jaVendeMarketplace,
      onboarding_tempo_vendendo: v.jaVendeMarketplace ? v.tempoVendendo : null,
      onboarding_metodos_envio: v.jaVendeMarketplace ? v.metodosEnvio : null,
      onboarding_vendas_mes: v.jaVendeMarketplace ? v.vendasMes : null,
      onboarding_completo: true,
    })
    .eq("id", ctx.clienteId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/drop/onboarding");
  revalidatePath("/drop/dashboard");
  return { ok: true };
}
