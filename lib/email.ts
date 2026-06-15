import { Resend } from "resend";
import { createHmac } from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM_EMAIL ?? "PH Representante <contato@phrepresentante.com.br>";

function buildActionUrl(baseUrl: string, id: string, action: string, brandSlug: string): string {
  const secret = process.env.EMAIL_ACTION_SECRET;
  if (!secret || !baseUrl) return "";
  const exp = String(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const sig  = createHmac("sha256", secret).update(`${id}:${action}:${brandSlug}:${exp}`).digest("hex");
  return `${baseUrl}/api/brand-action?id=${id}&action=${action}&brand=${brandSlug}&exp=${exp}&sig=${sig}`;
}

// ── Alerta para a marca quando cliente envia pedido ──────────────────────────

interface SendNewOrderAlertParams {
  id:          string;
  numero:      number;
  dataBR:      string;
  horaBR:      string;
  tipoPedido:  string;
  brandEmail:  string;
  brandName:   string;
  brandSlug:   string;
  clienteNome: string;
  total:       number;
  observacoes?: string | null;
}

function alertHtml({ id, numero, dataBR, horaBR, tipoPedido, brandName, brandSlug, clienteNome, total, observacoes }: SendNewOrderAlertParams) {
  const isDrop    = tipoPedido === "dropshipping";
  const fmt       = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const siteUrl   = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const approveUrl = !isDrop ? buildActionUrl(siteUrl, id, "confirmar_recebimento", brandSlug) : "";
  const rejectUrl  = buildActionUrl(siteUrl, id, "recusar", brandSlug);
  const panelUrl   = siteUrl ? `${siteUrl}/marca/pedidos/${id}` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

        <tr>
          <td style="background:#111;padding:24px 32px">
            <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
            <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Representação Comercial Automotiva</p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px;border-bottom:1px solid #f3f4f6">
            <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Novo Pedido Recebido</p>
            <p style="margin:6px 0 0;font-size:30px;font-weight:900;color:#111">#${numero}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280">${dataBR} · ${horaBR}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" valign="top" style="padding-right:16px">
                  <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Fornecedor</p>
                  <p style="margin:0;font-size:14px;font-weight:700;color:#111">${brandName}</p>
                </td>
                <td width="50%" valign="top">
                  <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Comprador</p>
                  <p style="margin:0;font-size:14px;font-weight:700;color:#111">${clienteNome}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px;border-bottom:1px solid #f3f4f6">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="top">
                  <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Tipo</p>
                  <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;${isDrop ? "background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe" : "background:#f3f4f6;color:#374151;border:1px solid #d1d5db"}">
                    ${isDrop ? "Dropshipping" : "Estoque"}
                  </span>
                </td>
                <td valign="top" align="right">
                  <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Total</p>
                  <p style="margin:0;font-size:22px;font-weight:900;color:#111">${total > 0 ? fmt(total) : "A definir"}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${isDrop ? `
        <tr>
          <td style="padding:16px 32px;border-bottom:1px solid #f3f4f6;background:#fffbeb">
            <p style="margin:0;font-size:12px;font-weight:700;color:#92400e">⚠ Pedido Dropshipping</p>
            <p style="margin:6px 0 0;font-size:12px;color:#78350f">As etiquetas dos clientes estão disponíveis no painel administrativo. Acesse para baixar e verificar as observações antes de confirmar o pedido.</p>
          </td>
        </tr>` : ""}

        ${observacoes ? `
        <tr>
          <td style="padding:16px 32px;border-bottom:1px solid #f3f4f6">
            <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Observações do comprador</p>
            <p style="margin:0;font-size:13px;color:#374151;font-style:italic">${observacoes}</p>
          </td>
        </tr>` : ""}

        ${(!isDrop && approveUrl) || rejectUrl ? `
        <tr>
          <td style="padding:20px 32px;border-bottom:1px solid #f3f4f6;background:#f0fdf4">
            <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#374151">Ação rápida — responda diretamente por este email:</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                ${!isDrop && approveUrl ? `<td style="padding-right:10px"><a href="${approveUrl}" style="display:inline-block;padding:10px 20px;background:#16a34a;color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">✅ Aprovar pedido</a></td>` : ""}
                ${rejectUrl ? `<td><a href="${rejectUrl}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">❌ Recusar pedido</a></td>` : ""}
              </tr>
            </table>
            ${isDrop ? '<p style="margin:12px 0 0;font-size:11px;color:#374151">⚠ Aprovação de dropshipping requer verificação de etiquetas no painel.</p>' : ""}
            ${panelUrl ? `<p style="margin:10px 0 0;font-size:11px;color:#9ca3af">Ou acesse o painel: <a href="${panelUrl}" style="color:#374151;font-weight:700">ver pedido</a></p>` : ""}
          </td>
        </tr>` : ""}

        <tr>
          <td style="padding:20px 32px;background:#f9fafb">
            <p style="margin:0;font-size:11px;color:#9ca3af">Links de ação rápida expiram em 7 dias. Acesse o painel para outras ações.</p>
            <p style="margin:8px 0 0;font-size:10px;color:#d1d5db">PH Representante · Representação Comercial Automotiva</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendNewOrderAlert(params: SendNewOrderAlertParams) {
  const adminEmail = process.env.EMAIL_ADMIN;
  const { numero, brandEmail, brandName, tipoPedido } = params;
  const isDrop = tipoPedido === "dropshipping";

  const cc = adminEmail && adminEmail !== brandEmail ? [adminEmail] : undefined;

  await resend.emails.send({
    from:    FROM,
    to:      [brandEmail],
    cc,
    subject: `Novo pedido #${numero} — ${isDrop ? "Dropshipping" : "Estoque"} | ${brandName}`,
    html:    alertHtml(params),
  });
}

// ── Confirmação ao cliente quando admin aprova ────────────────────────────────

interface SendApprovalEmailParams {
  numero:       number;
  clienteEmail: string;
  clienteNome:  string;
  brandName:    string;
  tipoPedido:   string;
  total:        number;
  observacoes?: string | null;
  hasEtiquetas: boolean;
}

function approvalHtml({ numero, clienteNome, brandName, tipoPedido, total, observacoes, hasEtiquetas }: SendApprovalEmailParams) {
  const isDrop   = tipoPedido === "dropshipping";
  const fmt      = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const portalUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

        <tr>
          <td style="background:#111;padding:24px 32px">
            <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
            <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Representação Comercial Automotiva</p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px;border-bottom:1px solid #f3f4f6;text-align:center">
            <p style="margin:0;font-size:32px">✅</p>
            <p style="margin:8px 0 0;font-size:20px;font-weight:900;color:#111">Pedido Confirmado!</p>
            <p style="margin:6px 0 0;font-size:13px;color:#6b7280">Olá, <strong>${clienteNome}</strong>. Seu pedido <strong>#${numero}</strong> foi aprovado.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" valign="top" style="padding-right:16px">
                  <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Fornecedor</p>
                  <p style="margin:0;font-size:14px;font-weight:700;color:#111">${brandName}</p>
                </td>
                <td width="50%" valign="top">
                  <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Total</p>
                  <p style="margin:0;font-size:18px;font-weight:900;color:#111">${total > 0 ? fmt(total) : "A definir"}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${isDrop && hasEtiquetas ? `
        <tr>
          <td style="padding:20px 32px;border-bottom:1px solid #f3f4f6;background:#eff6ff">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#1d4ed8">📦 Pedido Dropshipping — Ação necessária</p>
            <p style="margin:0 0 10px;font-size:13px;color:#1e40af">Acesse o portal para baixar as etiquetas de envio e registrar o horário limite de postagem.</p>
            ${portalUrl ? `<a href="${portalUrl}/portal/orcamentos" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">Acessar Portal</a>` : ""}
          </td>
        </tr>` : ""}

        ${observacoes ? `
        <tr>
          <td style="padding:16px 32px;border-bottom:1px solid #f3f4f6;background:#fffbeb">
            <p style="margin:0 0 4px;font-size:10px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:.8px">⚠ Observações do pedido</p>
            <p style="margin:0;font-size:13px;color:#78350f">${observacoes}</p>
          </td>
        </tr>` : ""}

        <tr>
          <td style="padding:20px 32px;background:#f9fafb">
            <p style="margin:0;font-size:11px;color:#9ca3af">Em caso de dúvidas entre em contato com a PH Representante.</p>
            <p style="margin:8px 0 0;font-size:10px;color:#d1d5db">PH Representante · Representação Comercial Automotiva</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendApprovalEmail(params: SendApprovalEmailParams) {
  const adminEmail = process.env.EMAIL_ADMIN;
  const { numero, clienteEmail, brandName, tipoPedido } = params;
  const isDrop = tipoPedido === "dropshipping";

  const cc = adminEmail && adminEmail !== clienteEmail ? [adminEmail] : undefined;

  await resend.emails.send({
    from:    FROM,
    to:      [clienteEmail],
    cc,
    subject: `Pedido #${numero} confirmado — ${brandName}${isDrop ? " (Dropshipping)" : ""}`,
    html:    approvalHtml(params),
  });
}

// ── Alerta ao fornecedor quando cliente altera pedido aprovado ────────────────

interface SendChangeAlertParams {
  numero:      number;
  brandEmail:  string;
  brandName:   string;
  clienteNome: string;
  motivo:      string;
  adminEmail?: string;
}

export async function sendChangeAlert({ numero, brandEmail, brandName, clienteNome, motivo, adminEmail }: SendChangeAlertParams) {
  const cc = adminEmail && adminEmail !== brandEmail ? [adminEmail] : undefined;

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <tr><td style="background:#111;padding:24px 32px">
    <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
  </td></tr>
  <tr><td style="padding:28px 32px;border-bottom:1px solid #f3f4f6">
    <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">⚠ Alteração em Pedido Aprovado</p>
    <p style="margin:6px 0 0;font-size:28px;font-weight:900;color:#111">#${numero}</p>
    <p style="margin:4px 0 0;font-size:13px;color:#6b7280">O comprador <strong>${clienteNome}</strong> realizou uma alteração neste pedido.</p>
  </td></tr>
  <tr><td style="padding:24px 32px;border-bottom:1px solid #f3f4f6;background:#fffbeb">
    <p style="margin:0 0 6px;font-size:10px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Motivo informado pelo comprador</p>
    <p style="margin:0;font-size:14px;color:#78350f;font-style:italic">"${motivo}"</p>
  </td></tr>
  <tr><td style="padding:20px 32px;background:#f9fafb">
    <p style="margin:0;font-size:11px;color:#9ca3af">Acesse o painel para verificar as alterações e tomar as devidas providências.</p>
    <p style="margin:8px 0 0;font-size:10px;color:#d1d5db">PH Representante · Representação Comercial Automotiva</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [brandEmail],
    cc,
    subject: `⚠ Alteração no pedido #${numero} — ${brandName} | ${clienteNome}`,
    html,
  });
}

// ── Fatura de cobrança ────────────────────────────────────────────────────────

interface InvoiceOrder {
  numero: number;
  created_at: string;
  marca: string | null;
  total: number;
  status_pagamento: string | null;
  condicao_pagamento: string | null;
}

interface SendInvoiceEmailParams {
  clienteEmail: string;
  clienteNome:  string;
  clienteCnpj:  string;
  pedidos:      InvoiceOrder[];
  mensagem?:    string;
}

export async function sendInvoiceEmail({ clienteEmail, clienteNome, clienteCnpj, pedidos, mensagem }: SendInvoiceEmailParams) {
  const adminEmail = process.env.EMAIL_ADMIN;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const total = pedidos.reduce((s, p) => s + Number(p.total ?? 0), 0);
  const portalUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const spLabels: Record<string, string> = { em_aberto: "Em aberto", atrasado: "Atrasado", pago: "Pago" };
  const spColors: Record<string, string> = { em_aberto: "#ca8a04", atrasado: "#dc2626", pago: "#16a34a" };

  const rows = pedidos.map((p) => {
    const dataBR = new Date(p.created_at).toLocaleDateString("pt-BR");
    const sp     = p.status_pagamento ?? "em_aberto";
    return `
    <tr style="border-bottom:1px solid #f3f4f6">
      <td style="padding:10px 12px;font-size:12px;font-weight:700;color:#111">#${p.numero}</td>
      <td style="padding:10px 12px;font-size:12px;color:#6b7280">${dataBR}</td>
      <td style="padding:10px 12px;font-size:12px;color:#6b7280">${p.marca ?? "—"}</td>
      <td style="padding:10px 12px;font-size:12px;color:#111;font-weight:700;text-align:right">${fmt(Number(p.total ?? 0))}</td>
      <td style="padding:10px 12px;text-align:center">
        <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:${spColors[sp]}22;color:${spColors[sp]};border:1px solid ${spColors[sp]}44">${spLabels[sp] ?? sp}</span>
      </td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

  <tr><td style="background:#111;padding:24px 32px">
    <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
    <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Representação Comercial Automotiva</p>
  </td></tr>

  <tr><td style="padding:28px 32px;border-bottom:1px solid #f3f4f6">
    <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Cobrança / Fatura</p>
    <p style="margin:6px 0 4px;font-size:20px;font-weight:900;color:#111">${clienteNome}</p>
    <p style="margin:0;font-size:12px;color:#6b7280">CNPJ: ${clienteCnpj}</p>
  </td></tr>

  ${mensagem ? `
  <tr><td style="padding:16px 32px;border-bottom:1px solid #f3f4f6;background:#fffbeb">
    <p style="margin:0 0 4px;font-size:10px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Mensagem da PH Representante</p>
    <p style="margin:0;font-size:13px;color:#78350f">${mensagem}</p>
  </td></tr>` : ""}

  <tr><td style="padding:0 32px 24px">
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
          <th style="padding:10px 12px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:.8px">Pedido</th>
          <th style="padding:10px 12px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:.8px">Data</th>
          <th style="padding:10px 12px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:.8px">Marca</th>
          <th style="padding:10px 12px;font-size:10px;font-weight:700;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:.8px">Valor</th>
          <th style="padding:10px 12px;font-size:10px;font-weight:700;color:#6b7280;text-align:center;text-transform:uppercase;letter-spacing:.8px">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f9fafb;border-top:2px solid #e5e7eb">
          <td colspan="3" style="padding:14px 12px;font-size:12px;font-weight:700;color:#6b7280;text-align:right">Total pendente</td>
          <td style="padding:14px 12px;font-size:18px;font-weight:900;color:#111;text-align:right">${fmt(total)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </td></tr>

  <tr><td style="padding:0 32px 32px">
    <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:16px 20px">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#92400e">Como efetuar o pagamento</p>
      <p style="margin:0;font-size:12px;color:#78350f">Entre em contato com a PH Representante para acertar as condições e realizar o pagamento dos pedidos em aberto.</p>
      ${portalUrl ? `<p style="margin:10px 0 0;font-size:11px;color:#78350f">Acesse o portal: <a href="${portalUrl}/portal" style="color:#92400e;font-weight:700">${portalUrl}/portal</a></p>` : ""}
    </div>
  </td></tr>

  <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
    <p style="margin:0;font-size:11px;color:#9ca3af">Em caso de dúvidas entre em contato com a PH Representante.</p>
    <p style="margin:8px 0 0;font-size:10px;color:#d1d5db">PH Representante · Representação Comercial Automotiva</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  const cc = adminEmail && adminEmail !== clienteEmail ? [adminEmail] : undefined;

  await resend.emails.send({
    from:    FROM,
    to:      [clienteEmail],
    cc,
    subject: `Fatura PH Representante — ${pedidos.length} pedido${pedidos.length !== 1 ? "s" : ""} · ${fmt(total)}`,
    html,
  });
}

// ── Confirmação de pagamento ao cliente ──────────────────────────────────────

interface SendPaymentConfirmationEmailParams {
  numero:       number;
  clienteEmail: string;
  clienteNome:  string;
  marca?:       string;
  total:        number;
}

export async function sendPaymentConfirmationEmail({ numero, clienteEmail, clienteNome, marca, total }: SendPaymentConfirmationEmailParams) {
  const adminEmail = process.env.EMAIL_ADMIN;
  const fmt        = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const portalUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const cc         = adminEmail && adminEmail !== clienteEmail ? [adminEmail] : undefined;

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

  <tr><td style="background:#111;padding:24px 32px">
    <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
    <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Representação Comercial Automotiva</p>
  </td></tr>

  <tr><td style="padding:28px 32px;border-bottom:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;font-size:40px">💰</p>
    <p style="margin:10px 0 0;font-size:22px;font-weight:900;color:#16a34a">Pagamento Confirmado!</p>
    <p style="margin:8px 0 0;font-size:13px;color:#6b7280">Olá, <strong>${clienteNome}</strong>. O pagamento do pedido <strong>#${numero}</strong> foi recebido e confirmado.</p>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${marca ? `<td width="50%" valign="top" style="padding-right:16px">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Fornecedor</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:#111">${marca}</p>
        </td>` : ""}
        <td valign="top" ${marca ? "" : 'align="center"'}>
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Valor confirmado</p>
          <p style="margin:0;font-size:${marca ? "18" : "24"}px;font-weight:900;color:#16a34a">${total > 0 ? fmt(total) : "—"}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 32px;background:#f0fdf4;border-bottom:1px solid #bbf7d0">
    <p style="margin:0;font-size:13px;color:#15803d;font-weight:600">✅ Pedido #${numero} quitado.</p>
    <p style="margin:6px 0 0;font-size:12px;color:#166534">Obrigado pela pontualidade! Seu histórico de pagamentos está atualizado no portal.</p>
    ${portalUrl ? `<p style="margin:10px 0 0"><a href="${portalUrl}/portal/valores" style="display:inline-block;padding:8px 18px;background:#16a34a;color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">Ver meus pedidos</a></p>` : ""}
  </td></tr>

  <tr><td style="padding:20px 32px;background:#f9fafb">
    <p style="margin:0;font-size:11px;color:#9ca3af">Em caso de dúvidas entre em contato com a PH Representante.</p>
    <p style="margin:8px 0 0;font-size:10px;color:#d1d5db">PH Representante · Representação Comercial Automotiva</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [clienteEmail],
    cc,
    subject: `✅ Pagamento confirmado — Pedido #${numero} | PH Representante`,
    html,
  });
}

// ── Notificação de envio ao cliente (quando marca marca como enviado) ─────────

interface SendShippingEmailParams {
  numero:         number;
  clienteEmail:   string;
  clienteNome:    string;
  brandName:      string;
  total:          number;
  codigoRastreio?: string | null;
  transportadora?: string | null;
}

export async function sendShippingEmail({ numero, clienteEmail, clienteNome, brandName, total, codigoRastreio, transportadora }: SendShippingEmailParams) {
  const adminEmail = process.env.EMAIL_ADMIN;
  const portalUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const cc         = adminEmail && adminEmail !== clienteEmail ? [adminEmail] : undefined;
  const fmt        = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

  <tr><td style="background:#111;padding:24px 32px">
    <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
    <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Representação Comercial Automotiva</p>
  </td></tr>

  <tr><td style="padding:28px 32px;border-bottom:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;font-size:40px">🚚</p>
    <p style="margin:10px 0 0;font-size:22px;font-weight:900;color:#111">Pedido Enviado!</p>
    <p style="margin:8px 0 0;font-size:13px;color:#6b7280">Olá, <strong>${clienteNome}</strong>. Seu pedido <strong>#${numero}</strong> foi despachado.</p>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="33%" valign="top" style="padding-right:12px">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Fornecedor</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:#111">${brandName}</p>
        </td>
        ${transportadora ? `<td width="33%" valign="top" style="padding-right:12px">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Transportadora</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:#111">${transportadora}</p>
        </td>` : ""}
        <td valign="top">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Total a pagar</p>
          <p style="margin:0;font-size:18px;font-weight:900;color:#e65100">${total > 0 ? fmt(total) : "A definir"}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  ${codigoRastreio ? `
  <tr><td style="padding:20px 32px;border-bottom:1px solid #f3f4f6;background:#eff6ff">
    <p style="margin:0 0 4px;font-size:10px;color:#1d4ed8;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Código de Rastreio</p>
    <p style="margin:0;font-size:18px;font-weight:900;color:#1d4ed8;font-family:monospace">${codigoRastreio}</p>
  </td></tr>` : ""}

  <tr><td style="padding:20px 32px;background:#f9fafb">
    ${portalUrl ? `<p style="margin:0"><a href="${portalUrl}/portal/orcamentos" style="display:inline-block;padding:10px 20px;background:#111;color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">Acompanhar no portal</a></p>` : ""}
    <p style="margin:${portalUrl ? "12px" : "0"} 0 0;font-size:11px;color:#9ca3af">Em caso de dúvidas entre em contato com a PH Representante.</p>
    <p style="margin:8px 0 0;font-size:10px;color:#d1d5db">PH Representante · Representação Comercial Automotiva</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [clienteEmail],
    cc,
    subject: `🚚 Pedido #${numero} enviado — ${brandName}`,
    html,
  });
}

// ── Via de expedição (sem valores) para o email da expedição da marca ────────

interface SendExpedicaoEmailParams {
  expedicaoEmail: string;
  numero:         number;
  marcaNome:      string;
  clienteNome:    string;
  clienteEndereco?: string;
  isDrop:         boolean;
  items:          { sku: string; nome: string; quantidade: number }[];
  labels:         { nome: string; url: string }[];
  observacoes?:   string | null;
}

export async function sendExpedicaoEmail({
  expedicaoEmail, numero, marcaNome, clienteNome, clienteEndereco,
  isDrop, items, labels, observacoes,
}: SendExpedicaoEmailParams) {
  const rows = items.map((it, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
      <td style="padding:8px 10px;font-size:11px;font-weight:700;color:#c0392b;border-bottom:1px solid #f3f4f6;white-space:nowrap">${it.sku}</td>
      <td style="padding:8px 10px;font-size:12px;color:#111;border-bottom:1px solid #f3f4f6">${it.nome}</td>
      <td style="padding:8px 10px;font-size:13px;font-weight:900;color:#111;border-bottom:1px solid #f3f4f6;text-align:center">${it.quantidade}</td>
    </tr>`).join("");

  const labelsHtml = labels.length > 0 ? `
    <tr><td colspan="3" style="padding:0">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-top:1px solid #fde68a">
        <tr><td style="padding:14px 16px">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.6px">📦 Etiquetas de envio (Dropshipping)</p>
          ${labels.map(l => `<p style="margin:4px 0"><a href="${l.url}" style="font-size:12px;color:#1d4ed8;font-weight:600;text-decoration:underline">${l.nome}</a></p>`).join("")}
        </td></tr>
      </table>
    </td></tr>` : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

  <tr><td style="background:#c0392b;padding:16px 24px">
    <span style="font-size:11px;font-weight:900;color:#fff;letter-spacing:1.5px;text-transform:uppercase">EXPEDIÇÃO — ${marcaNome}</span>
  </td></tr>

  <tr><td style="padding:20px 24px;border-bottom:1px solid #f3f4f6">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td valign="top">
          <p style="margin:0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Pedido</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:900;color:#111;line-height:1">#${numero}</p>
          ${isDrop ? '<span style="display:inline-block;margin-top:6px;padding:2px 8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;font-size:10px;font-weight:700;color:#1d4ed8">Dropshipping</span>' : ""}
        </td>
        <td valign="top" align="right">
          <p style="margin:0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Destino</p>
          <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#111">${clienteNome}</p>
          ${clienteEndereco ? `<p style="margin:3px 0 0;font-size:11px;color:#6b7280">${clienteEndereco}</p>` : ""}
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:0">
    <table width="100%" cellpadding="0" cellspacing="0">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:8px 10px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb;border-top:1px solid #e5e7eb;white-space:nowrap">SKU</th>
          <th style="padding:8px 10px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb;border-top:1px solid #e5e7eb">Produto</th>
          <th style="padding:8px 10px;font-size:10px;font-weight:700;color:#6b7280;text-align:center;border-bottom:1px solid #e5e7eb;border-top:1px solid #e5e7eb;width:60px">Qtd</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      ${labelsHtml}
    </table>
  </td></tr>

  ${observacoes ? `
  <tr><td style="padding:14px 24px;border-top:1px solid #f3f4f6;background:#fffbeb">
    <p style="margin:0 0 4px;font-size:10px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:.6px">Observações</p>
    <p style="margin:0;font-size:12px;color:#78350f;font-style:italic">${observacoes}</p>
  </td></tr>` : ""}

  <tr><td style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb">
    <p style="margin:0;font-size:10px;color:#9ca3af">PH Representante — uso interno, sem valores comerciais.</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  const badge = isDrop ? " [DROP]" : "";
  await resend.emails.send({
    from:    FROM,
    to:      [expedicaoEmail],
    subject: `📦 Expedição — Pedido #${numero}${badge} · ${clienteNome}`,
    html,
  });
}

// ── Confirmação para o cliente drop quando marca confirma o despacho ─────────

interface SendDropshippingDispatchedParams {
  numero:       number;
  clienteEmail: string;
  clienteNome:  string;
  brandName:    string;
  total:        number;
}

export async function sendDropshippingDispatchedEmail({ numero, clienteEmail, clienteNome, brandName, total }: SendDropshippingDispatchedParams) {
  const adminEmail = process.env.EMAIL_ADMIN;
  const portalUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const cc         = adminEmail && adminEmail !== clienteEmail ? [adminEmail] : undefined;
  const fmt        = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

  <tr><td style="background:#111;padding:24px 32px">
    <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
    <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Representação Comercial Automotiva</p>
  </td></tr>

  <tr><td style="padding:28px 32px;border-bottom:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;font-size:40px">📦</p>
    <p style="margin:10px 0 0;font-size:22px;font-weight:900;color:#111">Pedido Despachado!</p>
    <p style="margin:8px 0 0;font-size:13px;color:#6b7280">Olá, <strong>${clienteNome}</strong>. Seu pedido dropshipping <strong>#${numero}</strong> foi despachado ao comprador.</p>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" valign="top" style="padding-right:16px">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Fornecedor</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:#111">${brandName}</p>
        </td>
        <td width="50%" valign="top">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Valor a cobrar</p>
          <p style="margin:0;font-size:18px;font-weight:900;color:#e65100">${total > 0 ? fmt(total) : "A definir"}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 32px;border-bottom:1px solid #f3f4f6;background:#eff6ff">
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#1d4ed8">Dropshipping — O que acontece agora?</p>
    <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6">
      O produto foi enviado diretamente ao comprador do Mercado Livre. O valor de <strong>${total > 0 ? fmt(total) : "—"}</strong> será incluído na sua próxima cobrança semanal.
    </p>
    ${portalUrl ? `<p style="margin:12px 0 0"><a href="${portalUrl}/portal/orcamentos" style="display:inline-block;padding:8px 18px;background:#2563eb;color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">Ver no portal</a></p>` : ""}
  </td></tr>

  <tr><td style="padding:20px 32px;background:#f9fafb">
    <p style="margin:0;font-size:11px;color:#9ca3af">Em caso de dúvidas entre em contato com a PH Representante.</p>
    <p style="margin:8px 0 0;font-size:10px;color:#d1d5db">PH Representante · Representação Comercial Automotiva</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [clienteEmail],
    cc,
    subject: `📦 Dropshipping #${numero} despachado ao comprador — ${brandName}`,
    html,
  });
}

// ── Notificação do fornecedor (via admin) para o cliente ──────────────────────

interface SendSupplierNotificationParams {
  numero:       number;
  clienteEmail: string;
  clienteNome:  string;
  brandName:    string;
  tipo:         "nao_enviara_hoje" | "alteracao";
  mensagem?:    string;
}

export async function sendSupplierNotification({ numero, clienteEmail, clienteNome, brandName, tipo, mensagem }: SendSupplierNotificationParams) {
  const adminEmail = process.env.EMAIL_ADMIN;
  const cc = adminEmail && adminEmail !== clienteEmail ? [adminEmail] : undefined;

  const isNaoEnviaraHoje = tipo === "nao_enviara_hoje";
  const titulo  = isNaoEnviaraHoje ? "Pedido não será enviado hoje" : "Houve uma alteração no seu pedido";
  const icone   = isNaoEnviaraHoje ? "📦" : "⚠️";
  const corBg   = isNaoEnviaraHoje ? "#eff6ff" : "#fffbeb";
  const corText = isNaoEnviaraHoje ? "#1e40af" : "#78350f";

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <tr><td style="background:#111;padding:24px 32px">
    <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
  </td></tr>
  <tr><td style="padding:28px 32px;border-bottom:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;font-size:28px">${icone}</p>
    <p style="margin:8px 0 0;font-size:18px;font-weight:900;color:#111">${titulo}</p>
    <p style="margin:6px 0 0;font-size:13px;color:#6b7280">Pedido <strong>#${numero}</strong> · Fornecedor: <strong>${brandName}</strong></p>
  </td></tr>
  <tr><td style="padding:24px 32px;border-bottom:1px solid #f3f4f6;background:${corBg}">
    <p style="margin:0;font-size:13px;color:${corText}">
      ${isNaoEnviaraHoje
        ? `Olá <strong>${clienteNome}</strong>, informamos que o pedido <strong>#${numero}</strong> <u>não será enviado hoje</u>. Em breve você receberá uma nova atualização.`
        : `Olá <strong>${clienteNome}</strong>, houve uma alteração no seu pedido <strong>#${numero}</strong>. Por favor, acesse o portal para verificar os detalhes.`
      }
    </p>
    ${mensagem ? `<p style="margin:12px 0 0;font-size:13px;color:${corText};font-style:italic">"${mensagem}"</p>` : ""}
  </td></tr>
  <tr><td style="padding:20px 32px;background:#f9fafb">
    <p style="margin:0;font-size:11px;color:#9ca3af">Em caso de dúvidas entre em contato com a PH Representante.</p>
    <p style="margin:8px 0 0;font-size:10px;color:#d1d5db">PH Representante · Representação Comercial Automotiva</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [clienteEmail],
    cc,
    subject: `${icone} ${titulo} — Pedido #${numero} | ${brandName}`,
    html,
  });
}

// ── Confirmação ao cliente quando marca confirma recebimento (em_separacao) ───

interface SendOrderReceivedEmailParams {
  numero:       number;
  clienteEmail: string;
  clienteNome:  string;
  brandName:    string;
  tipoPedido:   string;
  total:        number;
}

export async function sendOrderReceivedEmail({ numero, clienteEmail, clienteNome, brandName, tipoPedido, total }: SendOrderReceivedEmailParams) {
  const adminEmail = process.env.EMAIL_ADMIN;
  const portalUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const cc         = adminEmail && adminEmail !== clienteEmail ? [adminEmail] : undefined;
  const isDrop     = tipoPedido === "dropshipping";
  const fmt        = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

  <tr><td style="background:#111;padding:24px 32px">
    <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
    <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Representação Comercial Automotiva</p>
  </td></tr>

  <tr><td style="padding:28px 32px;border-bottom:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;font-size:40px">📦</p>
    <p style="margin:10px 0 0;font-size:22px;font-weight:900;color:#111">Pedido Recebido!</p>
    <p style="margin:8px 0 0;font-size:13px;color:#6b7280">Olá, <strong>${clienteNome}</strong>. Seu pedido <strong>#${numero}</strong> foi recebido e está em separação.</p>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="33%" valign="top" style="padding-right:12px">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Fornecedor</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:#111">${brandName}</p>
        </td>
        <td width="33%" valign="top" style="padding-right:12px">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Tipo</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:#111">${isDrop ? "Dropshipping" : "Estoque"}</p>
        </td>
        <td width="33%" valign="top">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Total</p>
          <p style="margin:0;font-size:18px;font-weight:900;color:#111">${total > 0 ? fmt(total) : "A definir"}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 32px;border-bottom:1px solid #f3f4f6;background:#f0fdf4">
    <p style="margin:0;font-size:13px;color:#15803d;font-weight:600">✅ Status: Em separação</p>
    <p style="margin:6px 0 0;font-size:12px;color:#166534">
      ${isDrop
        ? "A marca confirmou o recebimento das etiquetas e está separando os produtos para envio."
        : "A marca confirmou o recebimento do pedido e está separando os produtos."
      }
    </p>
    ${portalUrl ? `<p style="margin:10px 0 0"><a href="${portalUrl}/portal/orcamentos" style="display:inline-block;padding:8px 18px;background:#16a34a;color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">Acompanhar pedido</a></p>` : ""}
  </td></tr>

  <tr><td style="padding:20px 32px;background:#f9fafb">
    <p style="margin:0;font-size:11px;color:#9ca3af">Em caso de dúvidas entre em contato com a PH Representante.</p>
    <p style="margin:8px 0 0;font-size:10px;color:#d1d5db">PH Representante · Representação Comercial Automotiva</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [clienteEmail],
    cc,
    subject: `📦 Pedido #${numero} recebido e em separação — ${brandName}`,
    html,
  });
}

// ── Cobrança semanal para o cliente ──────────────────────────────────────────

interface WeeklyBillingOrder {
  numero: number;
  created_at: string;
  total: number;
}

interface SendWeeklyBillingEmailParams {
  clienteEmail: string;
  clienteNome:  string;
  brandName:    string;
  weekLabel:    string;
  pedidos:      WeeklyBillingOrder[];
  total:        number;
}

export async function sendWeeklyBillingEmail({ clienteEmail, clienteNome, brandName, weekLabel, pedidos, total }: SendWeeklyBillingEmailParams) {
  const adminEmail = process.env.EMAIL_ADMIN;
  const portalUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const cc         = adminEmail && adminEmail !== clienteEmail ? [adminEmail] : undefined;
  const fmt        = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const rows = pedidos.map((p) => `
    <tr style="border-bottom:1px solid #f3f4f6">
      <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#111">#${p.numero}</td>
      <td style="padding:10px 12px;font-size:12px;color:#6b7280">${new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#111;text-align:right">${fmt(Number(p.total ?? 0))}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

  <tr><td style="background:#111;padding:24px 32px">
    <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
    <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Representação Comercial Automotiva</p>
  </td></tr>

  <tr><td style="padding:28px 32px;border-bottom:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;font-size:40px">📅</p>
    <p style="margin:10px 0 0;font-size:22px;font-weight:900;color:#111">Cobrança Semanal</p>
    <p style="margin:8px 0 0;font-size:13px;color:#6b7280">Olá, <strong>${clienteNome}</strong>. Segue o resumo dos pedidos da semana.</p>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" valign="top" style="padding-right:16px">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Fornecedor</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:#111">${brandName}</p>
        </td>
        <td width="50%" valign="top">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Semana</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:#111">${weekLabel}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 32px 24px">
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
          <th style="padding:10px 12px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:.8px">Pedido</th>
          <th style="padding:10px 12px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:.8px">Data</th>
          <th style="padding:10px 12px;font-size:10px;font-weight:700;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:.8px">Valor</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f9fafb;border-top:2px solid #e5e7eb">
          <td colspan="2" style="padding:14px 12px;font-size:12px;font-weight:700;color:#6b7280;text-align:right">Total da semana</td>
          <td style="padding:14px 12px;font-size:20px;font-weight:900;color:#e63946;text-align:right">${fmt(total)}</td>
        </tr>
      </tfoot>
    </table>
  </td></tr>

  <tr><td style="padding:0 32px 24px">
    <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:16px 20px">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#92400e">Como efetuar o pagamento</p>
      <p style="margin:0;font-size:12px;color:#78350f">Realize o pagamento via PIX até sexta-feira. Em seguida, envie o comprovante pelo WhatsApp ou pelo portal.</p>
      ${portalUrl ? `<p style="margin:10px 0 0"><a href="${portalUrl}/portal/cobrancas" style="display:inline-block;padding:10px 20px;background:#111;color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">Ver cobranças no portal</a></p>` : ""}
    </div>
  </td></tr>

  <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
    <p style="margin:0;font-size:11px;color:#9ca3af">Em caso de dúvidas entre em contato com a PH Representante.</p>
    <p style="margin:8px 0 0;font-size:10px;color:#d1d5db">PH Representante · Representação Comercial Automotiva</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [clienteEmail],
    cc,
    subject: `📅 Cobrança semanal — ${weekLabel} · ${brandName} · ${fmt(total)}`,
    html,
  });
}

// ── Solicitação de acesso: notifica a marca ───────────────────────────────────

interface SendAccessRequestEmailParams {
  marcaEmail:  string;
  marcaNome:   string;
  clienteNome: string;
  clienteCnpj: string;
}

export async function sendAccessRequestEmail({ marcaEmail, marcaNome, clienteNome, clienteCnpj }: SendAccessRequestEmailParams) {
  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const panelUrl = siteUrl ? `${siteUrl}/marca/clientes` : "";
  const adminEmail = process.env.EMAIL_ADMIN;
  const cc = adminEmail && adminEmail !== marcaEmail ? [adminEmail] : undefined;

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

  <tr><td style="background:#111;padding:24px 32px">
    <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
    <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Representação Comercial Automotiva</p>
  </td></tr>

  <tr><td style="padding:28px 32px;border-bottom:1px solid #f3f4f6">
    <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Nova solicitação de acesso</p>
    <p style="margin:8px 0 0;font-size:22px;font-weight:900;color:#111">${marcaNome}</p>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" valign="top" style="padding-right:16px">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Cliente</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:#111">${clienteNome}</p>
        </td>
        <td width="50%" valign="top">
          <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">CNPJ</p>
          <p style="margin:0;font-size:13px;font-weight:600;color:#374151;font-family:monospace">${clienteCnpj}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 32px;border-bottom:1px solid #f3f4f6;background:#f0fdf4">
    <p style="margin:0 0 12px;font-size:13px;color:#374151">Este cliente solicita acesso ao seu catálogo. Acesse o painel para aprovar ou recusar:</p>
    ${panelUrl ? `<a href="${panelUrl}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">Ver solicitação no painel</a>` : ""}
  </td></tr>

  <tr><td style="padding:20px 32px;background:#f9fafb">
    <p style="margin:0;font-size:11px;color:#9ca3af">PH Representante · Representação Comercial Automotiva</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [marcaEmail],
    cc,
    subject: `Nova solicitação de acesso — ${clienteNome} | ${marcaNome}`,
    html,
  });
}

// ── Status de acesso: notifica o cliente ──────────────────────────────────────

interface SendAccessStatusEmailParams {
  clienteEmail: string;
  clienteNome:  string;
  marcaNome:    string;
  action:       "aprovado" | "recusado" | "bloqueado" | "desbloquear";
  observacao?:  string | null;
}

export async function sendAccessStatusEmail({ clienteEmail, clienteNome, marcaNome, action, observacao }: SendAccessStatusEmailParams) {
  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const adminEmail = process.env.EMAIL_ADMIN;
  const cc = adminEmail && adminEmail !== clienteEmail ? [adminEmail] : undefined;

  const configs = {
    aprovado:     { emoji: "✅", title: "Acesso aprovado!", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", msg: `Você agora tem acesso ao catálogo de <strong>${marcaNome}</strong> e pode realizar pedidos.` },
    recusado:     { emoji: "❌", title: "Solicitação recusada", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", msg: `Sua solicitação de acesso ao catálogo de <strong>${marcaNome}</strong> foi recusada.` },
    bloqueado:    { emoji: "🔒", title: "Acesso suspenso", color: "#d97706", bg: "#fffbeb", border: "#fde68a", msg: `Seu acesso ao catálogo de <strong>${marcaNome}</strong> foi temporariamente suspenso.` },
    desbloquear:  { emoji: "🔓", title: "Acesso reativado!", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", msg: `Seu acesso ao catálogo de <strong>${marcaNome}</strong> foi reativado.` },
  };
  const cfg = configs[action];

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

  <tr><td style="background:#111;padding:24px 32px">
    <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
    <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Representação Comercial Automotiva</p>
  </td></tr>

  <tr><td style="padding:28px 32px;border-bottom:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;font-size:40px">${cfg.emoji}</p>
    <p style="margin:10px 0 0;font-size:22px;font-weight:900;color:#111">${cfg.title}</p>
    <p style="margin:8px 0 0;font-size:13px;color:#6b7280">Olá, <strong>${clienteNome}</strong></p>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #f3f4f6;background:${cfg.bg};border-left:4px solid ${cfg.color}">
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6">${cfg.msg}</p>
    ${observacao ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280;font-style:italic">Motivo: ${observacao}</p>` : ""}
  </td></tr>

  ${action === "aprovado" ? `
  <tr><td style="padding:20px 32px;border-bottom:1px solid #f3f4f6;text-align:center">
    ${siteUrl ? `<a href="${siteUrl}/portal/marcas" style="display:inline-block;padding:12px 24px;background:#e63946;color:#fff;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">Acessar catálogo no portal</a>` : ""}
  </td></tr>` : ""}

  <tr><td style="padding:20px 32px;background:#f9fafb">
    <p style="margin:0;font-size:11px;color:#9ca3af">Em caso de dúvidas, entre em contato com a PH Representante.</p>
    <p style="margin:8px 0 0;font-size:10px;color:#d1d5db">PH Representante · Representação Comercial Automotiva</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  const subjects: Record<string, string> = {
    aprovado:    `✅ Acesso aprovado — ${marcaNome} | PH Representante`,
    recusado:    `❌ Solicitação recusada — ${marcaNome} | PH Representante`,
    bloqueado:   `🔒 Acesso suspenso — ${marcaNome} | PH Representante`,
    desbloquear: `🔓 Acesso reativado — ${marcaNome} | PH Representante`,
  };

  await resend.emails.send({
    from:    FROM,
    to:      [clienteEmail],
    cc,
    subject: subjects[action],
    html,
  });
}

// ── Convite de acesso ao painel da marca ──────────────────────────────────────

interface SendBrandInviteEmailParams {
  marcaEmail: string;
  marcaNome:  string;
  resetLink:  string;
  isResend?:  boolean;
}

export async function sendBrandInviteEmail({ marcaEmail, marcaNome, resetLink, isResend }: SendBrandInviteEmailParams) {
  const portalUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">

  <tr><td style="background:#111;padding:24px 32px">
    <span style="font-size:18px;font-weight:900;color:#e63946;letter-spacing:1px">PH REPRESENTANTE</span>
    <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Representação Comercial Automotiva</p>
  </td></tr>

  <tr><td style="padding:28px 32px;border-bottom:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;font-size:36px">🏪</p>
    <p style="margin:10px 0 0;font-size:20px;font-weight:900;color:#111">${isResend ? "Novo link de acesso" : "Bem-vindo ao Painel da Marca!"}</p>
    <p style="margin:8px 0 0;font-size:13px;color:#6b7280">
      ${isResend
        ? `Você solicitou um novo link de acesso para <strong>${marcaNome}</strong>.`
        : `O acesso ao painel da marca <strong>${marcaNome}</strong> foi criado para você.`
      }
    </p>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
    <p style="margin:0 0 8px;font-size:13px;color:#374151">
      ${isResend ? "Use o link abaixo para definir uma nova senha e acessar o painel:" : "Clique no botão abaixo para definir sua senha e começar a usar o painel:"}
    </p>
    <p style="margin:16px 0 0;text-align:center">
      <a href="${resetLink}" style="display:inline-block;padding:14px 28px;background:#e63946;color:#fff;border-radius:10px;font-size:14px;font-weight:900;text-decoration:none;letter-spacing:.3px">
        ${isResend ? "Definir nova senha" : "Criar minha senha"}
      </a>
    </p>
    <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;text-align:center">Este link expira em 24 horas.</p>
  </td></tr>

  <tr><td style="padding:20px 32px;border-bottom:1px solid #f3f4f6;background:#f9fafb">
    <p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Após criar a senha, acesse em:</p>
    ${portalUrl
      ? `<a href="${portalUrl}/marca/login" style="font-size:13px;color:#e63946;font-weight:700;text-decoration:none">${portalUrl}/marca/login</a>`
      : `<span style="font-size:13px;color:#374151;font-weight:700">/marca/login</span>`
    }
  </td></tr>

  <tr><td style="padding:20px 32px;background:#f9fafb">
    <p style="margin:0;font-size:11px;color:#9ca3af">Se você não reconhece este acesso, ignore este email ou entre em contato com a PH Representante.</p>
    <p style="margin:8px 0 0;font-size:10px;color:#d1d5db">PH Representante · Representação Comercial Automotiva</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [marcaEmail],
    subject: isResend
      ? `🔑 Novo link de acesso — Painel ${marcaNome} | PH Representante`
      : `🏪 Acesso criado — Painel ${marcaNome} | PH Representante`,
    html,
  });
}

// ── Notificação de novo cadastro para o admin ─────────────────────────────────

export async function sendNewRegistrationAdminEmail({
  adminEmail, razaoSocial, cnpj, email, cidade, estado, whatsapp,
}: {
  adminEmail: string; razaoSocial: string; cnpj: string;
  email: string; cidade: string; estado: string; whatsapp: string;
}) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <tr><td style="background:#111827;padding:16px 24px">
    <span style="font-size:11px;font-weight:900;color:#fff;letter-spacing:1.5px;text-transform:uppercase">PH Representante — Novo Cadastro</span>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 16px;font-size:14px;color:#374151">Um novo cliente solicitou acesso ao portal:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      ${[
        ["Razão Social", razaoSocial],
        ["CNPJ", cnpj],
        ["E-mail", email],
        ["WhatsApp", whatsapp],
        ["Cidade/UF", `${cidade}/${estado}`],
      ].map(([k, v], i) => `
      <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"}">
        <td style="padding:9px 14px;font-size:11px;font-weight:700;color:#6b7280;width:130px">${k}</td>
        <td style="padding:9px 14px;font-size:12px;color:#111827;font-weight:600">${v}</td>
      </tr>`).join("")}
    </table>
    <div style="margin-top:20px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">
      <p style="margin:0;font-size:12px;color:#92400e">Status: <strong>Pendente de análise</strong> — acesse o painel admin para aprovar ou recusar.</p>
    </div>
  </td></tr>
  <tr><td style="padding:12px 24px;background:#f9fafb;border-top:1px solid #e5e7eb">
    <p style="margin:0;font-size:10px;color:#9ca3af">PH Representante — notificação automática</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [adminEmail],
    subject: `🆕 Novo cadastro: ${razaoSocial} | PH Representante`,
    html,
  });
}

// ── Confirmação de cadastro recebido para o cliente ───────────────────────────

export async function sendRegistrationReceivedEmail({
  clienteEmail, razaoSocial,
}: {
  clienteEmail: string; razaoSocial: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://phrepresentante.com.br";
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <tr><td style="background:#c0392b;padding:20px 24px;text-align:center">
    <span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:1px">PH Representante</span>
  </td></tr>
  <tr><td style="padding:32px 24px;text-align:center">
    <div style="width:56px;height:56px;background:#d1fae5;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
      <span style="font-size:28px">✅</span>
    </div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:900;color:#111827">Cadastro recebido!</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6">
      Olá, <strong style="color:#111827">${razaoSocial}</strong>!<br>
      Seu cadastro foi recebido e está em análise pela nossa equipe.<br>
      Você receberá um e-mail assim que o acesso for liberado.
    </p>
    <div style="padding:14px 20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 24px">
      <p style="margin:0;font-size:12px;color:#374151">
        Enquanto isso, você já pode acessar nosso portal com as credenciais cadastradas
        após a aprovação.
      </p>
    </div>
    <a href="${siteUrl}/portal/login"
       style="display:inline-block;padding:12px 28px;background:#c0392b;color:#fff;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none">
      Acessar o Portal
    </a>
  </td></tr>
  <tr><td style="padding:12px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center">
    <p style="margin:0;font-size:10px;color:#9ca3af">PH Representante · Peças e acessórios automotivos</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [clienteEmail],
    subject: "✅ Cadastro recebido — PH Representante",
    html,
  });
}
