import { sendEmail, resendConfigurado } from "@/lib/email/resend";
import { wrapEmail } from "@/lib/email/template";
import { enviarWhatsapp } from "@/lib/sistema/zapi-omni";
import { normalizarWhatsappBR } from "@/lib/sistema/format";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.phrepresentante.com.br";
}

interface SellerContato {
  nome: string;
  email: string | null;
  whatsapp: string | null;
}

async function notificarSeller(
  seller: SellerContato,
  opts: { subject: string; heading: string; bodyHtml: string; textoWhatsapp: string; cta?: { label: string; href: string } }
) {
  if (seller.email && resendConfigurado()) {
    try {
      await sendEmail({
        to: seller.email,
        subject: opts.subject,
        html: wrapEmail({ heading: opts.heading, bodyHtml: opts.bodyHtml, cta: opts.cta }),
      });
    } catch (e) {
      console.error("notificarSeller email:", e);
    }
  }
  const whatsapp = normalizarWhatsappBR(seller.whatsapp);
  if (whatsapp) {
    const res = await enviarWhatsapp(whatsapp, opts.textoWhatsapp);
    if (!res.ok) console.error("notificarSeller whatsapp:", res.error);
  }
}

/** Seller confirmou o e-mail mas não foi aprovado automaticamente (CNPJ
 *  inativo na Receita ou outro motivo) — avisa que entrou na fila de
 *  revisão manual, pra não ficar esperando sem saber o status. */
export async function notificarSellerEmAnalise(seller: SellerContato): Promise<void> {
  await notificarSeller(seller, {
    subject: "Seu cadastro está em análise — PH Representante",
    heading: `Recebido, ${seller.nome}!`,
    bodyHtml: `<p style="margin:0;">Confirmamos seu e-mail. Seu cadastro como seller da PH Representante está em análise pelo nosso time — avisamos assim que for aprovado.</p>`,
    textoWhatsapp: `Olá, ${seller.nome}! Confirmamos seu e-mail — seu cadastro como seller da PH Representante está em análise pelo nosso time. Avisamos assim que for aprovado.`,
  });
}

/** Cadastro aprovado (automático na confirmação de e-mail, ou manual pelo
 *  Sistema) — catálogo liberado, manda o link do painel. */
export async function notificarSellerAprovado(seller: SellerContato): Promise<void> {
  const link = `${siteUrl()}/drop/dashboard`;
  await notificarSeller(seller, {
    subject: "Cadastro aprovado — PH Representante",
    heading: `Boa notícia, ${seller.nome}!`,
    bodyHtml: `<p style="margin:0;">Seu cadastro como seller da PH Representante foi aprovado — seu acesso ao catálogo de dropshipping já está liberado.</p>`,
    textoWhatsapp: `Boa notícia, ${seller.nome}! Seu cadastro como seller da PH Representante foi aprovado — seu acesso já está liberado:\n${link}`,
    cta: { label: "Acessar meu painel", href: link },
  });
}
