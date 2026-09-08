import { NextResponse } from "next/server";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { sendEmail, resendConfigurado } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alertas comerciais diários. Chamado pelo Vercel Cron (ver vercel.json).
 * - tarefas pendentes vencidas / de hoje  → notificação para o responsável
 * - clientes ativos sem comprar há +30 dias → notificação para o vendedor
 * Com ?email=1, também manda um resumo por e-mail para cada usuário.
 *
 * Idempotente no dia: não recria uma notificação com o mesmo título nas
 * últimas 20 horas.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const enviarEmail = new URL(req.url).searchParams.get("email") === "1";
  const db = await createSistemaAdminClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const limite20h = new Date(Date.now() - 20 * 3600_000).toISOString();

  // ---- perfis ativos (para e-mail) ----
  const { data: perfis } = await db
    .from("profiles")
    .select("id, nome, email, ativo");
  const perfilMap = new Map(
    (perfis ?? []).map((p) => [p.id as string, p as { id: string; nome: string | null; email: string | null; ativo: boolean }])
  );

  type Aviso = { userId: string; titulo: string; descricao: string; link: string; tipo: string };
  const avisos: Aviso[] = [];

  // ---- tarefas vencidas / de hoje ----
  const { data: tarefas } = await db
    .from("tarefas")
    .select("responsavel_id, data_prevista, status")
    .in("status", ["pendente", "em_andamento"])
    .not("data_prevista", "is", null)
    .lte("data_prevista", hoje);
  const porResp = new Map<string, number>();
  for (const t of tarefas ?? []) {
    const r = t.responsavel_id as string | null;
    if (r) porResp.set(r, (porResp.get(r) ?? 0) + 1);
  }
  for (const [userId, qtd] of porResp) {
    avisos.push({
      userId,
      tipo: "tarefa",
      titulo: `${qtd} tarefa${qtd > 1 ? "s" : ""} para hoje ou atrasada${qtd > 1 ? "s" : ""}`,
      descricao: "Abra as Tarefas para ver e concluir.",
      link: "/sistema/tarefas",
    });
  }

  // ---- clientes ativos parados há +30 dias ----
  const corte30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: clientes } = await db
    .from("clientes")
    .select("vendedor_id, data_ultima_compra, status")
    .in("status", ["ativo", "reativacao"]);
  const porVend = new Map<string, number>();
  for (const c of clientes ?? []) {
    const v = c.vendedor_id as string | null;
    if (!v) continue;
    const ultima = c.data_ultima_compra as string | null;
    if (!ultima || ultima < corte30) porVend.set(v, (porVend.get(v) ?? 0) + 1);
  }
  for (const [userId, qtd] of porVend) {
    avisos.push({
      userId,
      tipo: "cliente",
      titulo: `${qtd} cliente${qtd > 1 ? "s" : ""} sem comprar há +30 dias`,
      descricao: "Veja a lista em Relatórios → Clientes sem comprar.",
      link: "/sistema/relatorios?tab=inatividade",
    });
  }

  // ---- grava notificações (dedupe por título / 20h) ----
  let criadas = 0;
  for (const a of avisos) {
    const perfil = perfilMap.get(a.userId);
    if (!perfil?.ativo) continue;
    const { data: existe } = await db
      .from("notificacoes")
      .select("id")
      .eq("user_id", a.userId)
      .eq("titulo", a.titulo)
      .gte("created_at", limite20h)
      .maybeSingle();
    if (existe) continue;
    await db.from("notificacoes").insert({
      user_id: a.userId,
      tipo: a.tipo,
      titulo: a.titulo,
      descricao: a.descricao,
      link: a.link,
    });
    criadas++;
  }

  // ---- e-mail resumo (opcional) ----
  let emails = 0;
  if (enviarEmail && resendConfigurado()) {
    const porUser = new Map<string, Aviso[]>();
    for (const a of avisos) {
      if (!porUser.has(a.userId)) porUser.set(a.userId, []);
      porUser.get(a.userId)!.push(a);
    }
    for (const [userId, lista] of porUser) {
      const perfil = perfilMap.get(userId);
      if (!perfil?.ativo || !perfil.email) continue;
      const linhas = lista
        .map((a) => `<li style="margin:4px 0">${a.titulo}</li>`)
        .join("");
      try {
        await sendEmail({
          to: perfil.email,
          subject: "Resumo comercial do dia — PH Representante",
          html: `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
            <p>Olá, ${perfil.nome ?? ""}!</p>
            <p>Pontos de atenção de hoje:</p>
            <ul>${linhas}</ul>
            <p><a href="https://www.phrepresentante.com.br/sistema">Abrir o Sistema Comercial</a></p>
          </div>`,
        });
        await db.from("email_log").insert({
          tipo: "alerta",
          para: [perfil.email],
          assunto: "Resumo comercial do dia — PH Representante",
          status: "enviado",
        });
        emails++;
      } catch (e) {
        console.error("alerta email:", e);
      }
    }
  }

  return NextResponse.json({ ok: true, avisos: avisos.length, notificacoes: criadas, emails });
}
