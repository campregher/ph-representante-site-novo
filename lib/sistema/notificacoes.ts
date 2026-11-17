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
const TIMEZONE = "America/Sao_Paulo";
const DIAS_UTEIS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

/** 08h–18h, seg–sex, no horário de Brasília — fora disso só acumula (ver
 *  `processarResumoNotificacoesPorEmail`), manda tudo junto quando abrir o
 *  expediente de novo. */
function dentroDoHorarioComercial(agora = new Date()): boolean {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(agora);
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? "0");
  const diaSemana = partes.find((p) => p.type === "weekday")?.value ?? "";
  return DIAS_UTEIS.has(diaSemana) && hora >= 8 && hora < 18;
}

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

/** `[Nome do seller] resto do título` → separa o prefixo de agrupamento
 *  (ver `[${sellerNome}]` adicionado em dropshipping-pedido-sync.ts e
 *  dropshipping-pedido-envio-automatico.ts) do resto do título. Sem
 *  prefixo, cai no grupo "Outros avisos". */
function extrairSeller(titulo: string): { seller: string | null; resto: string } {
  const m = titulo.match(/^\[([^\]]+)\]\s*(.*)$/);
  return m ? { seller: m[1], resto: m[2] } : { seller: null, resto: titulo };
}

/** "Nova venda de dropshipping — pedido #121" → chave "Nova venda de
 *  dropshipping" + ref "pedido #121", pra contar repetição como total em
 *  vez de uma linha por pedido. Sem esse padrão, o próprio texto já é a
 *  chave (conta ocorrência idêntica, ex.: 2x o mesmo pacote automático). */
function normalizarContagem(resto: string): { chave: string; ref: string | null } {
  const m = resto.match(/^(.*?)\s*[—-]\s*(pedido\b.*)$/i);
  return m ? { chave: m[1].trim(), ref: m[2].trim() } : { chave: resto, ref: null };
}

interface ItemAgrupado {
  descricao: string | null;
  link: string | null;
  qtd: number;
  refs: string[];
}

/** Resumo agrupado por e-mail — no máximo 1 a cada `INTERVALO_RESUMO_MIN`
 *  minutos por destinatário, juntando tudo que ainda não entrou num resumo
 *  anterior (`notificacoes.email_enviado = false`). Fora do horário
 *  comercial (ver `dentroDoHorarioComercial`) só acumula, sem mandar — o
 *  primeiro gatilho depois que o expediente reabre manda tudo junto, já que
 *  a trava de tempo mínimo (`ultimo_resumo_notificacoes_em`) vai estar bem
 *  vencida. Dentro de cada e-mail, agrupa primeiro por seller (prefixo
 *  "[Nome]" no título — ver `extrairSeller`) e, dentro de cada seller,
 *  repetição do mesmo tipo de aviso (ex.: várias vendas novas) vira 1 linha
 *  com o total, não uma por ocorrência (ver `normalizarContagem`).
 *
 * Chamado de forma oportunista (depois de criar notificações e no cron
 * diário) — sem cron de verdade de 30 em 30 min (Vercel Hobby só libera
 * 1x/dia), então a cadência real depende do sistema estar recebendo
 * tráfego; o cron diário garante que não fica mais de 1 dia sem mandar se
 * não entrar tráfego nenhum. Nunca lança. */
export async function processarResumoNotificacoesPorEmail(userIds?: string[]): Promise<void> {
  if (!resendConfigurado() || !dentroDoHorarioComercial()) return;
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

      // seller (ou "Outros avisos") → chave do tipo de aviso → agrupado
      const porSeller = new Map<string, Map<string, ItemAgrupado>>();
      let totalEventos = 0;
      for (const n of itens) {
        const { seller, resto } = extrairSeller(n.titulo);
        const sellerChave = seller ?? "Outros avisos";
        const { chave, ref } = normalizarContagem(resto);
        const porTipo = porSeller.get(sellerChave) ?? new Map<string, ItemAgrupado>();
        const g = porTipo.get(chave);
        if (g) {
          g.qtd++;
          if (ref) g.refs.push(ref);
        } else {
          porTipo.set(chave, { descricao: n.descricao, link: n.link, qtd: 1, refs: ref ? [ref] : [] });
        }
        porSeller.set(sellerChave, porTipo);
        totalEventos++;
      }

      const blocos = [...porSeller.entries()]
        .sort(([a], [b]) => (a === "Outros avisos" ? 1 : b === "Outros avisos" ? -1 : a.localeCompare(b)))
        .map(([sellerChave, porTipo]) => {
          const linhas = [...porTipo.entries()]
            .map(([chave, g]) => {
              const link = g.link ? `${siteUrl()}${g.link}` : null;
              const detalhe = g.refs.length ? g.refs.join(", ") : g.descricao;
              return `<li style="margin-bottom:6px">
                <strong>${chave}</strong>${g.qtd > 1 ? ` — ${g.qtd} no total` : ""}
                ${detalhe ? `<br><span style="color:#555">${detalhe}</span>` : ""}
                ${link ? `<br><a href="${link}">${link}</a>` : ""}
              </li>`;
            })
            .join("");
          return `<div style="margin-bottom:14px">
            <p style="margin:0 0 4px;font-weight:bold">${sellerChave}</p>
            <ul style="padding-left:18px;margin:0">${linhas}</ul>
          </div>`;
        })
        .join("");

      try {
        await sendEmailBatch([
          {
            to: perfil.email as string,
            subject: `Resumo de notificações — ${totalEventos} evento(s)`,
            html: `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
              <p>O que aconteceu desde o último resumo:</p>
              ${blocos}
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
