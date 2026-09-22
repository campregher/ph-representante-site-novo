"use server";

import { createSistemaAdminClient } from "@/lib/supabase/server";
import { sellerCadastroSchema } from "@/lib/sistema/schemas";
import { onlyDigits } from "@/lib/sistema/format";
import { criarNotificacoes } from "@/lib/sistema/notificacoes";
import { sendEmail, resendConfigurado } from "@/lib/email/resend";
import type { ActionResult } from "@/lib/sistema/types";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.phrepresentante.com.br";
}

async function avisarNovoSeller(nome: string) {
  try {
    const db = await createSistemaAdminClient();
    const { data: gestores } = await db
      .from("profiles")
      .select("id")
      .in("role", ["admin", "gerente"])
      .eq("ativo", true);
    await criarNotificacoes(
      (gestores ?? []).map((g) => ({
        userId: g.id as string,
        tipo: "seller",
        titulo: `Novo cadastro de seller: ${nome}`,
        descricao: "Auto-cadastro pelo /drop/cadastro — está como 'prospect', aguardando aprovação.",
        link: "/sistema/clientes?status=prospect",
      }))
    );
  } catch (e) {
    console.error("avisarNovoSeller:", e);
  }
}

/** Cliente novo — precisa confirmar o e-mail antes de qualquer coisa (D1). */
async function enviarConfirmacaoEmail(email: string | null, nome: string, portalToken: string) {
  if (!email || !resendConfigurado()) return;
  const link = `${siteUrl()}/drop/confirmar/${portalToken}`;
  try {
    await sendEmail({
      to: email,
      subject: "Confirme seu e-mail — PH Representante",
      html: `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <p>Olá, ${nome}!</p>
        <p>Recebemos seu cadastro como seller da PH Representante. Falta só confirmar seu e-mail
        pra gente analisar seu documento e liberar o acesso automaticamente.</p>
        <p><a href="${link}">${link}</a></p>
      </div>`,
    });
  } catch (e) {
    console.error("enviarConfirmacaoEmail:", e);
  }
}

/** Cliente que já existia e virou seller agora — já é confiável, manda direto o portal. */
async function enviarBoasVindas(email: string | null, nome: string, portalToken: string) {
  if (!email || !resendConfigurado()) return;
  const link = `${siteUrl()}/drop/portal/${portalToken}`;
  try {
    await sendEmail({
      to: email,
      subject: "Cadastro recebido — PH Representante",
      html: `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <p>Olá, ${nome}!</p>
        <p>Recebemos seu cadastro como seller da PH Representante. Nosso time vai analisar e liberar
        seu acesso em breve.</p>
        <p>Guarde este link — é o seu acesso pessoal ao portal (sem precisar de senha):</p>
        <p><a href="${link}">${link}</a></p>
      </div>`,
    });
  } catch (e) {
    console.error("enviarBoasVindas:", e);
  }
}

/**
 * Cria (ou reaproveita) o usuário de Auth do seller e devolve o id. E-mail já
 * confirmado no Auth — a confirmação de verdade é a flag `email_confirmado`
 * (D1), controlada pelo link em /drop/confirmar/[token].
 */
async function criarAuthUser(
  db: Awaited<ReturnType<typeof createSistemaAdminClient>>,
  email: string,
  senha: string
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error) {
    if (error.code === "email_exists") {
      return { error: "Já existe uma conta com este e-mail. Faça login em /drop/login." };
    }
    return { error: error.message };
  }
  return { id: data.user.id };
}

/**
 * Auto-cadastro público de seller (sem login — /drop/cadastro). Usa o client
 * admin (service role) porque não há sessão. Cria o cliente com
 * is_seller=true, status='prospect' (fica pendente de aprovação — alguém do
 * time muda pra "ativo" pelo /sistema depois de conferir).
 *
 * Se já existe um cliente com o mesmo CNPJ/CPF: se já era seller, só avisa;
 * senão, marca is_seller=true nele e preenche os campos vazios (não sobrescreve
 * dado já cadastrado).
 */
export async function cadastrarSeller(
  raw: unknown
): Promise<ActionResult<{ jaExistia?: boolean }>> {
  const parsed = sellerCadastroSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;
  // o campo escondido pelo toggle PJ/PF pode chegar com valor antigo (RHF não
  // limpa input desmontado por padrão) — ignora o que não corresponde ao tipo escolhido
  const cnpj = v.tipo_pessoa === "juridica" && v.cnpj ? onlyDigits(v.cnpj) : null;
  const cpf = v.tipo_pessoa === "fisica" && v.cpf ? onlyDigits(v.cpf) : null;
  if (cnpj && cnpj.length !== 14) return { ok: false, error: "CNPJ inválido — precisa ter 14 dígitos." };
  if (cpf && cpf.length !== 11) return { ok: false, error: "CPF inválido — precisa ter 11 dígitos." };

  const db = await createSistemaAdminClient();

  const nome = v.razao_social || v.nome_fantasia || "seller";

  const { data: existente } = await db
    .from("clientes")
    .select(
      "id, is_seller, portal_token, auth_user_id, telefone, whatsapp, email, cep, logradouro, numero, complemento, bairro, cidade, estado"
    )
    .eq(cnpj ? "cnpj" : "cpf", cnpj ?? cpf)
    .maybeSingle();

  if (existente) {
    if (existente.is_seller && existente.auth_user_id) return { ok: true, jaExistia: true };

    // cliente antigo (de antes do login) ou recém convertido em seller ainda
    // não tem usuário de Auth — cria agora com o e-mail/senha que acabou de informar
    let authUserId = existente.auth_user_id as string | null;
    if (!authUserId) {
      const authRes = await criarAuthUser(db, v.email, v.senha);
      if ("error" in authRes) return { ok: false, error: authRes.error };
      authUserId = authRes.id;
    }

    if (existente.is_seller) {
      await db.from("clientes").update({ auth_user_id: authUserId }).eq("id", existente.id as string);
      return { ok: true, jaExistia: true };
    }

    // cliente já existente vira seller sem passar pela confirmação de e-mail (já é confiável)
    const preencheSeVazio: Record<string, unknown> = {
      is_seller: true,
      email_confirmado: true,
      auth_user_id: authUserId,
    };
    const camposOpcionais = [
      ["telefone", v.telefone],
      ["whatsapp", v.whatsapp],
      ["email", v.email],
      ["cep", v.cep],
      ["logradouro", v.logradouro],
      ["numero", v.numero],
      ["complemento", v.complemento],
      ["bairro", v.bairro],
      ["cidade", v.cidade],
      ["estado", v.estado],
    ] as const;
    for (const [campo, valor] of camposOpcionais) {
      if (valor && !existente[campo as keyof typeof existente]) preencheSeVazio[campo] = valor;
    }
    const { error } = await db.from("clientes").update(preencheSeVazio).eq("id", existente.id as string);
    if (error) return { ok: false, error: error.message };
    await Promise.all([
      avisarNovoSeller(nome),
      enviarBoasVindas(
        (v.email || existente.email) as string | null,
        nome,
        existente.portal_token as string
      ),
    ]);
    return { ok: true, jaExistia: true };
  }

  const authRes = await criarAuthUser(db, v.email, v.senha);
  if ("error" in authRes) return { ok: false, error: authRes.error };

  const { data: novo, error } = await db
    .from("clientes")
    .insert({
      tipo_pessoa: v.tipo_pessoa,
      cnpj,
      cpf,
      razao_social: v.razao_social,
      nome_fantasia: v.nome_fantasia,
      inscricao_estadual: v.inscricao_estadual,
      telefone: v.telefone,
      whatsapp: v.whatsapp || v.telefone,
      email: v.email,
      auth_user_id: authRes.id,
      cep: v.cep,
      logradouro: v.logradouro,
      numero: v.numero,
      complemento: v.complemento,
      bairro: v.bairro,
      cidade: v.cidade,
      estado: v.estado,
      status: "prospect",
      is_seller: true,
    })
    .select("portal_token")
    .single();
  if (error) {
    await db.auth.admin.deleteUser(authRes.id).catch(() => {});
    if (error.code === "23505") return { ok: false, error: "Já existe um cadastro com este documento." };
    return { ok: false, error: error.message };
  }
  await Promise.all([
    avisarNovoSeller(nome),
    enviarConfirmacaoEmail(v.email ?? null, nome, novo.portal_token as string),
  ]);
  return { ok: true, jaExistia: false };
}
