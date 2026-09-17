"use server";

import { revalidatePath } from "next/cache";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { disconnectMl } from "@/lib/sistema/ml-auth";
import type { ActionResult } from "@/lib/sistema/types";

/** Desconecta a conta ML do seller (portal público, autenticado só pelo token do link). */
export async function desconectarMlPortal(portalToken: string): Promise<ActionResult> {
  const db = await createSistemaAdminClient();
  const { data: cliente } = await db
    .from("clientes")
    .select("id")
    .eq("portal_token", portalToken)
    .maybeSingle();
  if (!cliente) return { ok: false, error: "Link inválido." };

  await disconnectMl(cliente.id as string);
  revalidatePath(`/drop/portal/${portalToken}`);
  return { ok: true };
}
