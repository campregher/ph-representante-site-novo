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
      "id, is_seller, portal_token, telefone, whatsapp, email, cep, logradouro, numero, complemento, bairro, cidade, estado"
    )
    .eq(cnpj ? "cnpj" : "cpf", cnpj ?? cpf)
    .maybeSingle();

  if (existente) {
    if (existente.is_seller) return { ok: true, jaExistia: true };
    const preencheSeVazio: Record<string, unknown> = { is_seller: true };
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
    if (error.code === "23505") return { ok: false, error: "Já existe um cadastro com este documento." };
    return { ok: false, error: error.message };
  }
  await Promise.all([
    avisarNovoSeller(nome),
    enviarBoasVindas(v.email ?? null, nome, novo.portal_token as string),
  ]);
  return { ok: true, jaExistia: false };
}
