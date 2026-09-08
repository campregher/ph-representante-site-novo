/**
 * Envio de e-mail via Resend (API REST, sem SDK — mesmo padrão do
 * app/api/leads/route.ts). Só use no servidor: a RESEND_API_KEY nunca
 * pode ir para o browser.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailAttachment {
  filename: string;
  /** conteúdo em base64 */
  content: string;
  contentType?: string;
}

export interface SendEmailInput {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  id: string | null;
}

export function resendConfigurado(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function fromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL ||
    "PH Representante <onboarding@resend.dev>"
  );
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada.");

  const body: Record<string, unknown> = {
    from: fromAddress(),
    to: input.to,
    subject: input.subject,
    html: input.html,
  };
  if (input.cc) body.cc = input.cc;
  if (input.bcc) body.bcc = input.bcc;
  if (input.text) body.text = input.text;
  if (input.replyTo) body.reply_to = input.replyTo;
  if (input.attachments?.length) {
    body.attachments = input.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      ...(a.contentType ? { content_type: a.contentType } : {}),
    }));
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Resend: ${data?.message ?? data?.name ?? res.statusText} (${res.status})`
    );
  }
  return { id: (data?.id as string) ?? null };
}
