"use server";

import { createSistemaAdminClient } from "@/lib/supabase/server";
import { sellerCadastroSchema, type SellerCadastroInput } from "@/lib/sistema/schemas";
import { onlyDigits, formatCNPJ, formatPhone, normalizarWhatsappBR } from "@/lib/sistema/format";
import { criarNotificacoes } from "@/lib/sistema/notificacoes";
import { sendEmail, resendConfigurado } from "@/lib/email/resend";
import { wrapEmail } from "@/lib/email/template";
import { buscarCnpj } from "@/lib/sistema/cnpj";
import { cnaeSellerPermitido, formatarCnae } from "@/lib/sistema/seller-cnae";
import { whatsappFoiVerificado } from "@/lib/sistema/actions/whatsapp-verificacao";
import { enviarWhatsapp } from "@/lib/sistema/zapi-omni";
import type { ActionResult } from "@/lib/sistema/types";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.phrepresentante.com.br";
}

/** Resumo legível dos dados preenchidos no formulário — usado tanto no
 *  e-mail (lista) quanto no WhatsApp (texto) do aviso interno pra PH. */
function resumoCadastroLinhas(v: SellerCadastroInput, cnpj: string | null): string[] {
  const linhas: string[] = [];
  if (cnpj) linhas.push(`CNPJ: ${formatCNPJ(cnpj)}`);
  if (v.razao_social) linhas.push(`Razão social: ${v.razao_social}`);
  if (v.nome_fantasia) linhas.push(`Nome fantasia: ${v.nome_fantasia}`);
  if (v.inscricao_estadual) linhas.push(`Inscrição estadual: ${v.inscricao_estadual}`);
  if (v.telefone) linhas.push(`Telefone: ${formatPhone(v.telefone)}`);
  if (v.whatsapp) linhas.push(`WhatsApp: ${formatPhone(v.whatsapp)}`);
  if (v.email) linhas.push(`E-mail: ${v.email}`);
  const endereco = [v.logradouro, v.numero, v.bairro, v.cidade, v.estado].filter(Boolean).join(", ");
  if (endereco) linhas.push(`Endereço: ${endereco}${v.cep ? ` — CEP ${v.cep}` : ""}`);
  return linhas;
}

/**
 * Avisa a PH de um cadastro de seller novo/convertido por três canais:
 * notificação in-app (admin/gerente), WhatsApp (número interno dedicado —
 * nunca o mesmo do canal remetente, senão vira "conversa consigo mesmo" e
 * nunca marca como não lida) e e-mail pros admins/gerentes (não pro contato
 * genérico da empresa, que cai em spam por from==to). O catálogo do seller
 * já fica bloqueado sozinho (status "prospect" → `liberado=false` em
 * seller-auth.ts) — essa função só avisa quem precisa aprovar.
 */
async function avisarNovoSeller(nome: string, linhas: string[]) {
  const linkSistema = `${siteUrl()}/sistema/clientes?status=prospect`;

  try {
    const db = await createSistemaAdminClient();
    const { data: gestores } = await db
      .from("profiles")
      .select("id, email")
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

    if (resendConfigurado()) {
      const destinatarios = new Set(
        (gestores ?? []).map((g) => g.email).filter((e): e is string => !!e)
      );
      // temporário — ver EMAIL_NOTIFICACAO_FALLBACK no .env.local
      if (process.env.EMAIL_NOTIFICACAO_FALLBACK) destinatarios.add(process.env.EMAIL_NOTIFICACAO_FALLBACK);

      await Promise.all(
        [...destinatarios].map((email) =>
          sendEmail({
            to: email,
            // remetente diferente do padrão — evita cair em spam quando o
            // destinatário é o mesmo endereço genérico da empresa (from==to).
            from: "PH Representante — Sistema <notificacoes@phrepresentante.com.br>",
            subject: `Novo cadastro de seller: ${nome}`,
            html: wrapEmail({
              heading: `Novo cadastro de seller: ${nome}`,
              bodyHtml: `
                <p style="margin:0 0 12px;">Recebido pelo formulário público (/drop/cadastro), está como <strong>"prospect"</strong> aguardando aprovação.</p>
                <ul style="margin:0;padding-left:18px;">${linhas.map((l) => `<li style="margin-bottom:4px;">${l}</li>`).join("")}</ul>
              `,
              cta: { label: "Abrir no Sistema", href: linkSistema },
            }),
          }).catch((e) => console.error("avisarNovoSeller email:", e))
        )
      );
    }
  } catch (e) {
    console.error("avisarNovoSeller notificacoes/email:", e);
  }

  const whatsappInterno = process.env.WHATSAPP_NOTIFICACAO_INTERNA;
  if (whatsappInterno) {
    const res = await enviarWhatsapp(
      whatsappInterno,
      `Novo cadastro de seller: ${nome}\n${linhas.map((l) => `• ${l}`).join("\n")}\n\nEstá como "prospect", aguardando aprovação:\n${linkSistema}`
    );
    if (!res.ok) console.error("avisarNovoSeller whatsapp:", res.error);
  }
}

/** Cliente novo — precisa confirmar o e-mail antes de qualquer coisa (D1). */
async function enviarConfirmacaoEmail(email: string | null, whatsapp: string | null, nome: string, portalToken: string) {
  const link = `${siteUrl()}/drop/confirmar/${portalToken}`;
  if (email && resendConfigurado()) {
    try {
      await sendEmail({
        to: email,
        subject: "Confirme seu e-mail — PH Representante",
        html: wrapEmail({
          heading: `Olá, ${nome}!`,
          bodyHtml: `<p style="margin:0;">Recebemos seu cadastro como seller da PH Representante. Falta só confirmar seu e-mail
            para que possamos analisar seu documento e liberar o acesso automaticamente.</p>`,
          cta: { label: "Confirmar e-mail", href: link },
        }),
      });
    } catch (e) {
      console.error("enviarConfirmacaoEmail:", e);
    }
  }
  const wppNormalizado = normalizarWhatsappBR(whatsapp);
  if (wppNormalizado) {
    const res = await enviarWhatsapp(
      wppNormalizado,
      `Olá, ${nome}! Recebemos seu cadastro como seller da PH Representante. Falta só confirmar seu e-mail pra analisarmos seu documento e liberar o acesso:\n${link}`
    );
    if (!res.ok) console.error("enviarConfirmacaoEmail whatsapp:", res.error);
  }
}

/** Cliente que já existia e virou seller agora — já é confiável, manda direto o portal. */
async function enviarBoasVindas(email: string | null, whatsapp: string | null, nome: string, portalToken: string) {
  const link = `${siteUrl()}/drop/portal/${portalToken}`;
  if (email && resendConfigurado()) {
    try {
      await sendEmail({
        to: email,
        subject: "Cadastro recebido — PH Representante",
        html: wrapEmail({
          heading: `Olá, ${nome}!`,
          bodyHtml: `
            <p style="margin:0 0 12px;">Recebemos seu cadastro como seller da PH Representante. Nosso time vai analisar e liberar seu acesso em breve.</p>
            <p style="margin:0;">Guarde este link — é o seu acesso pessoal ao portal (sem precisar de senha).</p>
          `,
          cta: { label: "Acessar meu portal", href: link },
        }),
      });
    } catch (e) {
      console.error("enviarBoasVindas:", e);
    }
  }
  const wppNormalizado = normalizarWhatsappBR(whatsapp);
  if (wppNormalizado) {
    const res = await enviarWhatsapp(
      wppNormalizado,
      `Olá, ${nome}! Recebemos seu cadastro como seller da PH Representante. Nosso time vai analisar e liberar seu acesso em breve.\n\nGuarde este link — é o seu acesso pessoal ao portal (sem precisar de senha):\n${link}`
    );
    if (!res.ok) console.error("enviarBoasVindas whatsapp:", res.error);
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

export type CnpjCadastroStatus = "novo" | "cliente" | "seller";

/**
 * Checagem rápida e só-leitura, usada no formulário assim que o CNPJ é
 * digitado/consultado — antes do usuário preencher as 4 etapas do cadastro,
 * pra avisar logo se já existe conta (evita retrabalho e o erro "e-mail já
 * existe" só no fim). Não cria nem altera nada.
 */
export async function verificarCnpjCadastro(cnpjRaw: string): Promise<{ status: CnpjCadastroStatus }> {
  const cnpj = onlyDigits(cnpjRaw);
  if (cnpj.length !== 14) return { status: "novo" };
  const db = await createSistemaAdminClient();
  const { data } = await db
    .from("clientes")
    .select("is_seller, auth_user_id")
    .eq("cnpj", cnpj)
    .maybeSingle();
  if (!data) return { status: "novo" };
  if (data.is_seller && data.auth_user_id) return { status: "seller" };
  return { status: "cliente" };
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
  const cnpj = v.cnpj ? onlyDigits(v.cnpj) : null;
  if (cnpj && cnpj.length !== 14) return { ok: false, error: "CNPJ inválido — precisa ter 14 dígitos." };

  const db = await createSistemaAdminClient();

  const nome = v.razao_social || v.nome_fantasia || "seller";

  const { data: existente } = await db
    .from("clientes")
    .select(
      "id, is_seller, portal_token, auth_user_id, telefone, whatsapp, email, cep, logradouro, numero, complemento, bairro, cidade, estado"
    )
    .eq("cnpj", cnpj)
    .maybeSingle();

  if (existente) {
    if (existente.is_seller && existente.auth_user_id) return { ok: true, jaExistia: true };
  }

  // Validação de CNAE — exigência dos fornecedores de dropshipping, que só
  // revendem pra quem comercializa peças/acessórios automotivos de verdade.
  // Refeita aqui no servidor (não só no form) pra não depender do client.
  // Desligável por CNAE_VALIDACAO_DESATIVADA=true — só pra teste manual com
  // CNPJ fictício; religar antes de voltar pra produção de verdade.
  if (cnpj && process.env.CNAE_VALIDACAO_DESATIVADA !== "true") {
    const cnpjRes = await buscarCnpj(cnpj);
    if ("error" in cnpjRes) {
      return { ok: false, error: "Não foi possível validar o CNAE deste CNPJ agora. Tente novamente em instantes." };
    }
    if (!cnaeSellerPermitido(cnpjRes.data.cnae_principal, cnpjRes.data.cnaes_secundarios)) {
      return {
        ok: false,
        error: `CNAE ${formatarCnae(cnpjRes.data.cnae_principal) || "não identificado"} não aceito — aceitamos apenas comércio de peças/acessórios automotivos (4530-7/01 ou 4530-7/03), exigência dos nossos fornecedores.`,
      };
    }
  }

  // Validação de WhatsApp (código OTP enviado em /drop/cadastro) — mesma
  // lógica da CNAE, refeita no servidor pra não depender só do client.
  if (v.whatsapp && !(await whatsappFoiVerificado(v.whatsapp))) {
    return { ok: false, error: "Confirme seu WhatsApp (código de verificação) antes de enviar o cadastro." };
  }

  if (existente) {
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
      // sempre sobrescreve (não só preenche se vazio) — acabou de ser
      // confirmado por OTP agora, então vale mais que qualquer valor antigo
      // já cadastrado (que pode nunca ter sido verificado).
      whatsapp: v.whatsapp,
    };
    const camposOpcionais = [
      ["telefone", v.telefone],
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
      avisarNovoSeller(nome, resumoCadastroLinhas(v, cnpj)),
      enviarBoasVindas(
        (v.email || existente.email) as string | null,
        v.whatsapp ?? null,
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
      tipo_pessoa: "juridica",
      cnpj,
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
    avisarNovoSeller(nome, resumoCadastroLinhas(v, cnpj)),
    enviarConfirmacaoEmail(v.email ?? null, v.whatsapp ?? null, nome, novo.portal_token as string),
  ]);
  return { ok: true, jaExistia: false };
}
