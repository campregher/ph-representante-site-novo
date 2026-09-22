"use server";

import { revalidatePath } from "next/cache";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { disconnectMl } from "@/lib/sistema/ml-auth";
import { validarDocumentoSeller } from "@/lib/sistema/seller-validacao";
import { criarNotificacoes } from "@/lib/sistema/notificacoes";
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

async function avisarGestores(titulo: string, descricao: string, link: string) {
  try {
    const db = await createSistemaAdminClient();
    const { data: gestores } = await db
      .from("profiles")
      .select("id")
      .in("role", ["admin", "gerente"])
      .eq("ativo", true);
    await criarNotificacoes(
      (gestores ?? []).map((g) => ({ userId: g.id as string, tipo: "seller", titulo, descricao, link }))
    );
  } catch (e) {
    console.error("avisarGestores:", e);
  }
}

/**
 * Confirma o e-mail do seller (clique no link mandado no cadastro) e, na
 * sequência, valida o documento pra decidir se aprova automático
 * (status prospect → ativo) ou deixa pendente pra revisão manual.
 */
export async function confirmarEmailSeller(
  portalToken: string
): Promise<ActionResult<{ jaConfirmado: boolean; aprovado: boolean; motivo: string; nome: string }>> {
  const db = await createSistemaAdminClient();
  const { data: cliente } = await db
    .from("clientes")
    .select("id, nome_fantasia, razao_social, cnpj, cpf, status, email_confirmado")
    .eq("portal_token", portalToken)
    .maybeSingle();
  if (!cliente) return { ok: false, error: "Link inválido." };

  const nome = (cliente.nome_fantasia as string) || (cliente.razao_social as string) || "seller";

  if (cliente.email_confirmado) {
    return { ok: true, jaConfirmado: true, aprovado: cliente.status === "ativo", motivo: "", nome };
  }

  const validacao = await validarDocumentoSeller({
    cnpj: cliente.cnpj as string | null,
    cpf: cliente.cpf as string | null,
  });

  const patch: Record<string, unknown> = { email_confirmado: true };
  if (validacao.aprovado && cliente.status === "prospect") patch.status = "ativo";
  if (!validacao.aprovado) patch.observacoes = `Aprovação automática negada: ${validacao.motivo}`;

  const { error } = await db.from("clientes").update(patch).eq("id", cliente.id as string);
  if (error) return { ok: false, error: error.message };

  if (validacao.aprovado) {
    await avisarGestores(
      `Seller aprovado automaticamente: ${nome}`,
      validacao.motivo,
      "/sistema/clientes?status=ativo"
    );
  } else {
    await avisarGestores(
      `Seller precisa de revisão manual: ${nome}`,
      validacao.motivo,
      "/sistema/clientes?status=prospect"
    );
  }

  return { ok: true, jaConfirmado: false, aprovado: validacao.aprovado, motivo: validacao.motivo, nome };
}
