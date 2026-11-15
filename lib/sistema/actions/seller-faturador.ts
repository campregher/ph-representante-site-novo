"use server";

import { revalidatePath } from "next/cache";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/sistema/seller-auth";
import type { ActionResult } from "@/lib/sistema/types";

/**
 * Autodeclaração do seller: já ativou o Faturador (emissor fiscal nativo)
 * no painel do Mercado Livre dele. Não existe endpoint de API pra confirmar
 * isso de fora — por isso é um campo autodeclarado, não uma checagem real.
 */
export async function salvarFaturadorAtivo(ativo: boolean): Promise<ActionResult> {
  const seller = await requireSeller();
  const db = await createSistemaAdminClient();
  const { error } = await db.from("clientes").update({ faturador_ml_ativo: ativo }).eq("id", seller.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/drop/dashboard/configuracao");
  return { ok: true };
}
