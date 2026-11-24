/** Casca visual compartilhada pros e-mails transacionais — cabeçalho escuro
 *  com a logo, barra vermelha de marca, corpo claro, CTA opcional em botão
 *  vermelho. Email-safe: tabela + estilos inline, sem CSS externo/fontes
 *  customizadas (a maioria dos clientes de e-mail ignora @font-face). */
const LOGO_URL = "https://www.phrepresentante.com.br/images/ph.png";
const BRAND = "#dc2626";
const DARK = "#111111";

export function wrapEmail({
  heading,
  bodyHtml,
  cta,
}: {
  heading: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
}): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
            <tr>
              <td style="background:${DARK};padding:20px 28px;">
                <img src="${LOGO_URL}" alt="PH Representante" width="120" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="height:3px;line-height:0;font-size:0;background:${BRAND};">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">
                <h1 style="margin:0 0 16px;font-size:18px;line-height:1.4;color:#111111;font-weight:bold;">${heading}</h1>
                <div style="font-size:14px;line-height:1.7;color:#333333;">${bodyHtml}</div>
                ${
                  cta
                    ? `<a href="${cta.href}" style="display:inline-block;margin-top:24px;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:8px;">${cta.label}</a>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#fafafa;border-top:1px solid #eeeeee;">
                <p style="margin:0;font-size:11px;color:#999999;">PH Representante · phrepresentante.com.br</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
