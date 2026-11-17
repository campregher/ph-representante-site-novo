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

const INTERVALO_RESUMO_MIN = 30;

/** Cria avisos in-app — o e-mail NÃO sai na hora (ver `processarResumoNotificacoesPorEmail`
 *  logo abaixo): mandar 1 e-mail por evento enchia a caixa de entrada/push do
 *  celular, inclusive com o mesmo aviso repetido várias vezes. Usa service
 *  role (cross-user, ignora RLS). Nunca lança. */
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
  // Oportunista: dispara a checagem do resumo pra quem acabou de receber um
  // aviso — só manda de verdade se já fez `INTERVALO_RESUMO_MIN` minutos
  // desde o último (trava em `profiles.ultimo_resumo_notificacoes_em`,
  // mesmo padrão do envio automático pro fornecedor). Nunca lança.
  try {
    await processarResumoNotificacoesPorEmail([...new Set(rows.map((r) => r.user_id))]);
  } catch (e) {
    console.error("criarNotificacoes -> processarResumoNotificacoesPorEmail:", e);
  }
}

interface NotificacaoPendente {
  id: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  created_at: string;
}

/** Resumo agrupado por e-mail — no máximo 1 a cada `INTERVALO_RESUMO_MIN`
 *  minutos por destinatário, juntando tudo que ainda não entrou num resumo
 *  anterior (`notificacoes.email_enviado = false`). Avisos repetidos (mesmo
 *  título) viram 1 linha só com a contagem, em vez de uma linha por
 *  ocorrência. Chamado de forma oportunista (depois de criar notificações,
 *  no webhook do ML e no cron diário) — sem cron de verdade de 30 em 30 min
 *  (Vercel Hobby só libera 1x/dia), então a cadência real depende do
 *  sistema estar recebendo tráfego; o cron diário garante que não fica mais
 *  de 1 dia sem mandar se não entrar tráfego nenhum. Nunca lança. */
export async function processarResumoNotificacoesPorEmail(userIds?: string[]): Promise<void> {
  if (!resendConfigurado()) return;
  try {
    const db = await createSistemaAdminClient();
    let q = db.from("profiles").select("id, email, ultimo_resumo_notificacoes_em").not("email", "is", null);
    if (userIds?.length) q = q.in("id", userIds);
    const { data: perfis } = await q;

    for (const perfil of perfis ?? []) {
      const ultimoEm = perfil.ultimo_resumo_notificacoes_em as string | null;
      if (ultimoEm && Date.now() - new Date(ultimoEm).getTime() < INTERVALO_RESUMO_MIN * 60 * 1000) continue;

      // Reclama o direito de mandar agora de forma atômica — só "pega" se a
      // condição ainda valer no banco nesse exato instante (evita 2 lotes
      // em dobro se duas chamadas caírem quase juntas).
      const limiar = new Date(Date.now() - INTERVALO_RESUMO_MIN * 60 * 1000).toISOString();
      const agora = new Date().toISOString();
      const { data: reclamado } = await db
        .from("profiles")
        .update({ ultimo_resumo_notificacoes_em: agora })
        .eq("id", perfil.id as string)
        .or(`ultimo_resumo_notificacoes_em.is.null,ultimo_resumo_notificacoes_em.lt.${limiar}`)
        .select("id");
      if (!reclamado?.length) continue;

      const { data: pendentes } = await db
        .from("notificacoes")
        .select("id, titulo, descricao, link, created_at")
        .eq("user_id", perfil.id as string)
        .eq("email_enviado", false)
        .order("created_at", { ascending: true })
        .limit(500);
      const itens = (pendentes ?? []) as NotificacaoPendente[];
      if (itens.length === 0) continue;

      const grupos = new Map<string, { descricao: string | null; link: string | null; qtd: number }>();
      for (const n of itens) {
        const g = grupos.get(n.titulo);
        if (g) g.qtd++;
        else grupos.set(n.titulo, { descricao: n.descricao, link: n.link, qtd: 1 });
      }

      const linhas = [...grupos.entries()]
        .map(([titulo, g]) => {
          const link = g.link ? `${siteUrl()}${g.link}` : null;
          return `<li style="margin-bottom:8px">
            <strong>${titulo}</strong>${g.qtd > 1 ? ` (${g.qtd}x)` : ""}
            ${g.descricao ? `<br><span style="color:#555">${g.descricao}</span>` : ""}
            ${link ? `<br><a href="${link}">${link}</a>` : ""}
          </li>`;
        })
        .join("");

      try {
        await sendEmailBatch([
          {
            to: perfil.email as string,
            subject: `Resumo de notificações — ${grupos.size} item(ns)`,
            html: `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
              <p>O que aconteceu nos últimos ${INTERVALO_RESUMO_MIN} minutos:</p>
              <ul style="padding-left:18px">${linhas}</ul>
            </div>`,
          },
        ]);
        await db
          .from("notificacoes")
          .update({ email_enviado: true })
          .in(
            "id",
            itens.map((n) => n.id)
          );
      } catch (e) {
        console.error("processarResumoNotificacoesPorEmail -> envio:", e);
      }
    }
  } catch (e) {
    console.error("processarResumoNotificacoesPorEmail:", e);
  }
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
