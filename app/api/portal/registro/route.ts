import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendNewRegistrationAdminEmail, sendRegistrationReceivedEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json() as {
    email:              string;
    password:           string;
    cnpj:               string;
    razao_social:       string;
    nome_fantasia?:     string | null;
    cnae_codigo?:       string | null;
    cnae_descricao?:    string | null;
    inscricao_estadual: string;
    cep?:               string | null;
    logradouro:         string;
    numero:             string;
    complemento?:       string | null;
    bairro?:            string | null;
    cidade:             string;
    estado:             string;
    whatsapp:           string;
  };

  const { email, password, cnpj, razao_social, nome_fantasia, cnae_codigo, cnae_descricao,
          inscricao_estadual, cep, logradouro, numero, complemento, bairro, cidade, estado, whatsapp } = body;

  if (!email || !password || !cnpj || !razao_social) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes" }, { status: 400 });
  }

  const db = await createAdminClient();

  // Verifica se CNPJ já cadastrado
  const { data: existing } = await db
    .from("clientes")
    .select("id")
    .eq("cnpj", cnpj.replace(/\D/g, ""))
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "CNPJ já cadastrado. Entre em contato se precisar de ajuda." }, { status: 409 });
  }

  // Cria usuário no Supabase Auth
  const { data: authData, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // não exige confirmação de email — aprovação manual pelo admin
  });

  if (authErr) {
    const msg = authErr.message.includes("already registered")
      ? "Este e-mail já está cadastrado. Tente fazer login."
      : authErr.message;
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  // Insere na tabela clientes
  const { error: dbErr } = await db.from("clientes").insert({
    user_id:            authData.user.id,
    cnpj:               cnpj.replace(/\D/g, ""),
    razao_social,
    nome_fantasia:      nome_fantasia   || null,
    cnae_codigo:        cnae_codigo     || null,
    cnae_descricao:     cnae_descricao  || null,
    inscricao_estadual,
    cep:                cep?.replace(/\D/g, "") || null,
    logradouro,
    numero,
    complemento:        complemento || null,
    bairro:             bairro      || null,
    cidade,
    estado,
    whatsapp,
    email,
    status: "pendente",
  });

  if (dbErr) {
    // Rollback: remove o usuário criado
    await db.auth.admin.deleteUser(authData.user.id).catch(() => {});
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  // Envia notificações (fire-and-forget, não bloqueiam a resposta)
  const adminEmail = process.env.EMAIL_ADMIN ?? process.env.LEAD_NOTIFICATION_EMAIL ?? "";

  if (adminEmail) {
    sendNewRegistrationAdminEmail({
      adminEmail,
      razaoSocial: razao_social,
      cnpj:        cnpj.replace(/\D/g, ""),
      email,
      cidade,
      estado,
      whatsapp,
    }).catch((e) => console.error("[email-new-registration-admin]", e));
  }

  sendRegistrationReceivedEmail({ clienteEmail: email, razaoSocial: razao_social })
    .catch((e) => console.error("[email-new-registration-client]", e));

  return NextResponse.json({ ok: true });
}
