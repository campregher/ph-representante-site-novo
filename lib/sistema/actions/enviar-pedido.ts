"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { getPedidoDoc } from "@/lib/sistema/pedido-doc";
import { renderPedidoPdf } from "@/lib/sistema/pedido-pdf";
import { pedidoEmailHtml, pedidoEmailSubject } from "@/lib/sistema/email/pedido-email";
import { sendEmail, resendConfigurado } from "@/lib/email/resend";
import { EMAIL as EMAIL_PADRAO } from "@/lib/constants";
import type { ActionResult } from "@/lib/sistema/types";

function parseEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
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

export async function enviarPedidoPorEmail(
  pedidoId: string,
  input: {
    para?: string;
    cc?: string;
    mensagem?: string;
    anexarPdf?: boolean;
    copiaParaMim?: boolean;
  }
): Promise<ActionResult<{ para?: string[] }>> {
  const profile = await getSistemaProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };
  if (profile.role === "consulta") return { ok: false, error: "Seu papel é somente leitura." };
  if (!resendConfigurado())
    return { ok: false, error: "Envio de e-mail não configurado (RESEND_API_KEY)." };

  const supabase = await createSistemaClient();
  const doc = await getPedidoDoc(pedidoId);
  if (!doc) return { ok: false, error: "Pedido não encontrado." };

  const { data: row } = await supabase
    .from("pedidos")
    .select("share_token")
    .eq("id", pedidoId)
    .maybeSingle();

  const informados = parseEmails(input.para);
  const para = informados.length ? informados : parseEmails(doc.cliente.email);
  if (!para.length)
    return {
      ok: false,
      error: "Nenhum e-mail de destino. Informe um endereço ou cadastre o e-mail do cliente.",
    };

  const cc = parseEmails(input.cc);
  if (input.copiaParaMim && profile.email) cc.push(profile.email);

  const linkPublico = row?.share_token ? `${await origem()}/p/${row.share_token}` : null;
  const anexar = input.anexarPdf !== false;

  const html = pedidoEmailHtml(doc, {
    linkPublico,
    mensagem: input.mensagem?.trim() || null,
    pdfAnexado: anexar,
  });
  const subject = pedidoEmailSubject(doc);

  let attachments;
  if (anexar) {
    try {
      const pdf = await renderPedidoPdf(doc);
      attachments = [
        {
          filename: `pedido-${doc.numero}.pdf`,
          content: pdf.toString("base64"),
          contentType: "application/pdf",
        },
      ];
    } catch (e) {
      console.error("PDF anexo:", e);
    }
  }

  try {
    const { id } = await sendEmail({
      to: para,
      cc: cc.length ? cc : undefined,
      subject,
      html,
      replyTo: profile.email || EMAIL_PADRAO,
      attachments,
    });

    await supabase
      .from("pedidos")
      .update({ enviado_email_at: new Date().toISOString() })
      .eq("id", pedidoId);
    await supabase.from("email_log").insert({
      tipo: "pedido",
      para,
      cc,
      assunto: subject,
      pedido_id: pedidoId,
      resend_id: id,
      status: "enviado",
      enviado_por: profile.id,
    });
    await supabase.from("pedido_historico").insert({
      pedido_id: pedidoId,
      status_novo: doc.statusLabel,
      descricao: `Pedido enviado por e-mail para ${para.join(", ")}`,
      usuario_id: profile.id,
    });

    revalidatePath(`/sistema/pedidos/${pedidoId}`);
    revalidatePath("/sistema/pedidos");
    return { ok: true, para };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar e-mail.";
    await supabase.from("email_log").insert({
      tipo: "pedido",
      para,
      cc,
      assunto: subject,
      pedido_id: pedidoId,
      status: "erro",
      erro: msg,
      enviado_por: profile.id,
    });
    return { ok: false, error: msg };
  }
}
