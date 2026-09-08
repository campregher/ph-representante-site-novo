"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { getEmpresaConfig } from "@/lib/sistema/config";
import { listAlvos, preencherVariaveis, renderCampanhaHtml } from "@/lib/sistema/campanhas";
import { sendEmailBatch, resendConfigurado, type BatchEmail } from "@/lib/email/resend";
import type { ActionResult } from "@/lib/sistema/types";

async function guard() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (profile.role === "consulta")
    return { profile: null, error: "Seu papel é somente leitura." as const };
  return { profile, error: null };
}

async function origem(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch {
    /* noop */
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.phrepresentante.com.br";
}

// ─────────────────────────────── Modelos ──────────────────────────────────

export async function salvarModelo(
  id: string | null,
  input: { nome: string; assunto: string; corpo: string; ativo?: boolean }
): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const nome = input.nome?.trim();
  const assunto = input.assunto?.trim();
  const corpo = input.corpo?.trim();
  if (!nome || !assunto || !corpo)
    return { ok: false, error: "Preencha nome, assunto e corpo." };

  const supabase = await createSistemaClient();
  if (id) {
    const { error } = await supabase
      .from("campanha_modelos")
      .update({ nome, assunto, corpo, ativo: input.ativo ?? true })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("campanha_modelos")
      .insert({ nome, assunto, corpo, created_by: g.profile!.id });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/sistema/campanhas");
  return { ok: true };
}

export async function excluirModelo(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("campanha_modelos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sistema/campanhas");
  return { ok: true };
}

// ────────────────────────────── Pré-visualização ──────────────────────────

export async function previsualizarCampanha(
  faixa: string,
  representadaId?: string
): Promise<
  ActionResult<{
    total?: number;
    enviaveis?: number;
    pulados?: number;
    amostra?: { nome: string; email: string; dias: number | null }[];
  }>
> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const alvos = await listAlvos({ faixa, representadaId: representadaId || undefined });
  const enviaveis = alvos.filter((a) => !a.jaRecebeu30d);
  return {
    ok: true,
    total: alvos.length,
    enviaveis: enviaveis.length,
    pulados: alvos.length - enviaveis.length,
    amostra: enviaveis.slice(0, 8).map((a) => ({ nome: a.nome, email: a.email, dias: a.dias })),
  };
}

// ─────────────────────────────── Disparo ──────────────────────────────────

const LOTE = 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function enviarCampanha(input: {
  nome: string;
  assunto: string;
  corpo: string;
  faixa: string;
  representadaId?: string;
}): Promise<ActionResult<{ enviado?: number; erro?: number; pulado?: number }>> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  if (!resendConfigurado())
    return { ok: false, error: "Envio de e-mail não configurado (RESEND_API_KEY)." };

  const nome = input.nome?.trim() || "Campanha de reativação";
  const assunto = input.assunto?.trim();
  const corpo = input.corpo?.trim();
  if (!assunto || !corpo) return { ok: false, error: "Assunto e mensagem são obrigatórios." };

  const alvos = await listAlvos({ faixa: input.faixa, representadaId: input.representadaId });
  const enviar = alvos.filter((a) => !a.jaRecebeu30d);
  const pular = alvos.filter((a) => a.jaRecebeu30d);
  if (!enviar.length)
    return {
      ok: false,
      error: pular.length
        ? "Todos os clientes desta faixa já receberam uma campanha nos últimos 30 dias."
        : "Nenhum cliente com e-mail nesta faixa.",
    };

  const supabase = await createSistemaClient();
  const emp = await getEmpresaConfig();
  const base = await origem();

  // e-mails dos vendedores (reply_to)
  const vendIds = [...new Set(enviar.map((a) => a.vendedor_id).filter(Boolean))] as string[];
  const vendEmail = new Map<string, string>();
  if (vendIds.length) {
    const { data } = await supabase.from("profiles").select("id, email").in("id", vendIds);
    for (const p of data ?? []) if (p.email) vendEmail.set(p.id as string, p.email as string);
  }

  const { data: camp, error: eCamp } = await supabase
    .from("campanhas")
    .insert({
      nome,
      tipo: "reativacao",
      assunto,
      corpo,
      faixa_min_dias: input.faixa === "nunca" ? null : Number(input.faixa),
      inclui_nunca: input.faixa === "nunca",
      representada_id: input.representadaId || null,
      criado_por: g.profile!.id,
      total_alvos: alvos.length,
    })
    .select("id")
    .single();
  if (eCamp) return { ok: false, error: eCamp.message };
  const campanhaId = camp.id as string;

  let okCount = 0;
  let errCount = 0;
  const enviosRows: Record<string, unknown>[] = [];
  const logRows: Record<string, unknown>[] = [];

  for (let i = 0; i < enviar.length; i += LOTE) {
    const chunk = enviar.slice(i, i + LOTE);
    const vars = (a: (typeof chunk)[number]) => ({
      nome: a.nome,
      vendedor: a.vendedorNome || emp.empresa_nome,
      dias: a.dias,
      empresa: emp.empresa_nome,
      origem: base,
      descadastroToken: a.descadastro_token,
    });
    const batch: BatchEmail[] = chunk.map((a) => ({
      to: a.email,
      subject: preencherVariaveis(assunto, {
        nome: a.nome,
        vendedor: a.vendedorNome || emp.empresa_nome,
        dias: a.dias,
        empresa: emp.empresa_nome,
      }),
      html: renderCampanhaHtml(corpo, vars(a)),
      replyTo: (a.vendedor_id && vendEmail.get(a.vendedor_id)) || g.profile!.email || undefined,
    }));

    try {
      const ids = await sendEmailBatch(batch);
      chunk.forEach((a, j) => {
        okCount++;
        enviosRows.push({
          campanha_id: campanhaId,
          cliente_id: a.id,
          email: a.email,
          status: "enviado",
          resend_id: ids[j],
        });
        logRows.push({
          tipo: "reativacao",
          para: [a.email],
          assunto,
          cliente_id: a.id,
          resend_id: ids[j],
          status: "enviado",
          enviado_por: g.profile!.id,
        });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no envio.";
      chunk.forEach((a) => {
        errCount++;
        enviosRows.push({
          campanha_id: campanhaId,
          cliente_id: a.id,
          email: a.email,
          status: "erro",
          motivo: msg,
        });
      });
    }
    if (i + LOTE < enviar.length) await sleep(600);
  }

  for (const a of pular) {
    enviosRows.push({
      campanha_id: campanhaId,
      cliente_id: a.id,
      email: a.email,
      status: "pulado",
      motivo: "Recebeu uma campanha de reativação nos últimos 30 dias.",
    });
  }

  if (enviosRows.length) await supabase.from("campanha_envios").insert(enviosRows);
  if (logRows.length) await supabase.from("email_log").insert(logRows);

  await supabase
    .from("campanhas")
    .update({
      total_enviado: okCount,
      total_erro: errCount,
      total_pulado: pular.length,
      enviado_em: new Date().toISOString(),
    })
    .eq("id", campanhaId);

  revalidatePath("/sistema/campanhas");
  return { ok: true, enviado: okCount, erro: errCount, pulado: pular.length };
}
