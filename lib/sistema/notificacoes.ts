import { createSistemaClient, createSistemaAdminClient } from "@/lib/supabase/server";
import { sendEmailBatch, resendConfigurado } from "@/lib/email/resend";

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

export interface NovaNotificacao {
  userId: string;
  tipo?: string;
  titulo: string;
  descricao?: string | null;
  link?: string | null;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.phrepresentante.com.br";
}

/** Manda por e-mail cada notificação já gravada (ponta a ponta — sem isso o
 *  aviso só aparecia no sininho do /sistema, exigia estar logado pra ver).
 *  Best-effort: sem RESEND_API_KEY ou qualquer erro, só loga e segue —
 *  nunca pode derrubar quem chamou criarNotificacoes. */
async function enviarEmailNotificacoes(
  rows: { user_id: string; titulo: string; descricao: string | null; link: string | null }[]
): Promise<void> {
  if (!resendConfigurado() || rows.length === 0) return;
  try {
    const db = await createSistemaAdminClient();
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: perfis } = await db.from("profiles").select("id, email").in("id", userIds);
    const emailPorUser = new Map((perfis ?? []).map((p) => [p.id as string, p.email as string | null]));

    const emails = rows
      .map((r) => {
        const email = emailPorUser.get(r.user_id);
        if (!email) return null;
        const link = r.link ? `${siteUrl()}${r.link}` : null;
        return {
          to: email,
          subject: r.titulo,
          html: `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
            <p><strong>${r.titulo}</strong></p>
            ${r.descricao ? `<p>${r.descricao}</p>` : ""}
            ${link ? `<p><a href="${link}">${link}</a></p>` : ""}
          </div>`,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (emails.length) await sendEmailBatch(emails);
  } catch (e) {
    console.error("enviarEmailNotificacoes:", e);
  }
}

/** Cria avisos in-app E manda por e-mail (quando o destinatário tem e-mail
 *  cadastrado e o Resend está configurado) — ponta a ponta pra quem chamar
 *  isso não precisar lembrar de mandar e-mail à parte em cada lugar. Usa
 *  service role (cross-user, ignora RLS). Nunca lança. */
export async function criarNotificacoes(itens: NovaNotificacao[]): Promise<void> {
  const rows = itens
    .filter((n) => n.userId && n.titulo)
    .map((n) => ({
      user_id: n.userId,
      tipo: n.tipo ?? "info",
      titulo: n.titulo,
      descricao: n.descricao ?? null,
      link: n.link ?? null,
    }));
  if (!rows.length) return;
  try {
    const db = await createSistemaAdminClient();
    await db.from("notificacoes").insert(rows);
  } catch (e) {
    console.error("criarNotificacoes:", e);
  }
  await enviarEmailNotificacoes(rows);
}

export async function criarNotificacao(n: NovaNotificacao): Promise<void> {
  return criarNotificacoes([n]);
}

/** Notificações do usuário logado (RLS). */
export async function getMinhasNotificacoes(
  limit = 20
): Promise<{ itens: Notificacao[]; naoLidas: number }> {
  const supabase = await createSistemaClient();
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("notificacoes")
      .select("id, tipo, titulo, descricao, link, lida, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("lida", false),
  ]);
  return { itens: (data as Notificacao[]) ?? [], naoLidas: count ?? 0 };
}
