"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { sendEmail, resendConfigurado } from "@/lib/email/resend";
import type { ActionResult } from "@/lib/sistema/types";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.phrepresentante.com.br";
}

const CONFIRMAR_EMAIL_VALIDADE_DIAS = 7;

/** Dispara a troca de e-mail de um seller: manda o link de confirmação pro
 *  endereço NOVO e deixa pendente (`email_pendente*`) — `clientes.email` e
 *  o login de verdade (`auth.users.email`) só mudam quando esse link for
 *  clicado (ver confirmarTrocaEmailSeller). Chamado por saveCliente quando
 *  detecta que o e-mail de um cliente is_seller mudou. */
export async function solicitarTrocaEmailSeller(
  clienteId: string,
  novoEmail: string,
  nome: string
): Promise<ActionResult> {
  const db = await createSistemaAdminClient();
  const token = randomUUID();
  const { error } = await db
    .from("clientes")
    .update({
      email_pendente: novoEmail,
      email_pendente_token: token,
      email_pendente_criado_em: new Date().toISOString(),
    })
    .eq("id", clienteId);
  if (error) return { ok: false, error: error.message };

  if (resendConfigurado()) {
    const link = `${siteUrl()}/drop/confirmar-email/${token}`;
    try {
      await sendEmail({
        to: novoEmail,
        subject: "Confirme seu novo e-mail — PH Representante",
        html: `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
          <p>Olá, ${nome}!</p>
          <p>Pediram a troca do seu e-mail de login na PH Representante para este endereço.
          Clique no link abaixo para confirmar — enquanto não confirmar, seu login antigo continua
          funcionando normalmente.</p>
          <p><a href="${link}">${link}</a></p>
          <p>Se você não pediu essa troca, ignore este e-mail.</p>
        </div>`,
      });
    } catch (e) {
      console.error("solicitarTrocaEmailSeller:", e);
    }
  }
  return { ok: true };
}

/** Confirma a troca (clique no link) — só aqui o login de verdade
 *  (auth.users.email, via admin API) e o `clientes.email` mudam. */
export async function confirmarTrocaEmailSeller(
  token: string
): Promise<ActionResult<{ nome: string; novoEmail: string }>> {
  const db = await createSistemaAdminClient();
  const { data: cliente } = await db
    .from("clientes")
    .select("id, nome_fantasia, razao_social, auth_user_id, email_pendente, email_pendente_criado_em")
    .eq("email_pendente_token", token)
    .maybeSingle();
  if (!cliente) return { ok: false, error: "Link inválido ou já usado." };

  const nome = (cliente.nome_fantasia as string) || (cliente.razao_social as string) || "seller";
  const novoEmail = cliente.email_pendente as string | null;
  const authUserId = cliente.auth_user_id as string | null;
  if (!novoEmail || !authUserId) return { ok: false, error: "Link inválido ou já usado." };

  const criadoEm = cliente.email_pendente_criado_em as string | null;
  if (criadoEm) {
    const diasPassados = (Date.now() - new Date(criadoEm).getTime()) / (1000 * 60 * 60 * 24);
    if (diasPassados > CONFIRMAR_EMAIL_VALIDADE_DIAS) {
      return { ok: false, error: "Esse link expirou. Peça a troca de e-mail de novo." };
    }
  }

  const { error: authError } = await db.auth.admin.updateUserById(authUserId, {
    email: novoEmail,
    email_confirm: true,
  });
  if (authError) return { ok: false, error: authError.message };

  const { error } = await db
    .from("clientes")
    .update({ email: novoEmail, email_pendente: null, email_pendente_token: null, email_pendente_criado_em: null })
    .eq("id", cliente.id as string);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sistema/clientes");
  revalidatePath(`/sistema/clientes/${cliente.id}`);
  return { ok: true, nome, novoEmail };
}
