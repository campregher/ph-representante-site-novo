"use server";

import { createSistemaAdminClient } from "@/lib/supabase/server";

/**
 * Opt-out / opt-in de e-mail de campanha. Público (sem login) — identificado
 * apenas pelo descadastro_token do cliente. Usa service role.
 */
export async function definirAceitaEmail(
  token: string,
  aceita: boolean
): Promise<{ ok: boolean; nome?: string; error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, error: "Link inválido." };
  const db = await createSistemaAdminClient();
  const { data, error } = await db
    .from("clientes")
    .update({ aceita_email: aceita })
    .eq("descadastro_token", token)
    .select("nome_fantasia, razao_social")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Link inválido ou expirado." };
  return {
    ok: true,
    nome: (data.nome_fantasia as string) || (data.razao_social as string) || undefined,
  };
}
