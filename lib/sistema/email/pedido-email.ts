import type { PedidoPDFData } from "@/components/pdf/PedidoPDF";
import { formatBRL, formatPercent } from "@/lib/sistema/format";

const BRAND = "#dc2626";
const INK = "#111827";
const MUT = "#6b7280";

export function pedidoEmailSubject(d: PedidoPDFData): string {
  return `Pedido #${d.numero} — ${d.empresa.nome}`;
}

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}

export function pedidoEmailHtml(
  d: PedidoPDFData,
  opts: { linkPublico?: string | null; mensagem?: string | null; pdfAnexado?: boolean } = {}
): string {
  const itens = d.itens
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:${INK}">
          <strong>${esc(it.sku)}</strong><br><span style="color:${MUT}">${esc(it.descricao)}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:center;color:${INK}">${it.qtd}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;color:${INK}">${formatBRL(it.preco)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;color:${INK}">${
          it.descPct > 0 ? "-" + formatPercent(it.descPct) : "—"
        }</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;font-weight:700;color:${INK}">${formatBRL(it.total)}</td>
      </tr>`
    )
    .join("");

  const linhaCondicoes = [
    d.tabela ? `Tabela: ${esc(d.tabela)}` : "",
    d.condicao_pagamento ? `Pagamento: ${esc(d.condicao_pagamento)}` : "",
    d.previsao_entrega ? `Previsão de entrega: ${esc(d.previsao_entrega)}` : "",
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  const btnLink = opts.linkPublico
    ? `<a href="${esc(opts.linkPublico)}" target="_blank" style="display:inline-block;padding:12px 24px;background:${BRAND};color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px">Ver pedido completo</a>`
    : "";

  const msg = opts.mensagem
    ? `<tr><td style="padding:0 32px 8px"><div style="background:#f9fafb;border-left:3px solid ${BRAND};padding:12px 16px;font-size:14px;color:${INK};white-space:pre-wrap">${esc(
        opts.mensagem
      )}</div></td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:28px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.07)">

  <tr><td style="background:${INK};padding:22px 32px">
    <span style="font-size:18px;font-weight:800;color:#fff">${esc(d.empresa.nome)}</span>
    <span style="float:right;font-size:13px;color:#9ca3af">Pedido #${d.numero} · ${esc(d.data)}</span>
  </td></tr>

  <tr><td style="padding:26px 32px 4px">
    <p style="margin:0;font-size:17px;font-weight:800;color:${INK}">Olá, ${esc(d.cliente.nome)}!</p>
    <p style="margin:8px 0 0;font-size:14px;color:${MUT};line-height:1.6">
      Segue o resumo do seu pedido com a <strong>${esc(d.representada.nome)}</strong>.
      ${opts.pdfAnexado ? "O PDF completo está anexado a este e-mail." : ""}
    </p>
  </td></tr>

  ${msg}

  ${
    linhaCondicoes
      ? `<tr><td style="padding:8px 32px 0;font-size:13px;color:${MUT}">${linhaCondicoes}</td></tr>`
      : ""
  }

  <tr><td style="padding:16px 32px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
      <tr style="background:#fafafa">
        <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:${MUT}">Produto</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;color:${MUT}">Qtd</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;color:${MUT}">Preço</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;color:${MUT}">Desc.</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;color:${MUT}">Total</th>
      </tr>
      ${itens}
    </table>
  </td></tr>

  <tr><td style="padding:14px 32px 0">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:13px;color:${MUT};padding:2px 0">Subtotal</td>
          <td style="font-size:13px;color:${INK};text-align:right">${formatBRL(d.subtotal)}</td></tr>
      <tr><td style="font-size:13px;color:${MUT};padding:2px 0">Desconto (${formatPercent(d.descontoPct)})</td>
          <td style="font-size:13px;color:${INK};text-align:right">-${formatBRL(d.descontoValor)}</td></tr>
      <tr><td style="font-size:15px;font-weight:800;color:${INK};padding:8px 0 0;border-top:1px solid #eee">TOTAL</td>
          <td style="font-size:15px;font-weight:800;color:${BRAND};text-align:right;padding:8px 0 0;border-top:1px solid #eee">${formatBRL(d.total)}</td></tr>
    </table>
  </td></tr>

  ${
    d.observacaoCliente
      ? `<tr><td style="padding:14px 32px 0;font-size:13px;color:${MUT}"><strong>Obs.:</strong> ${esc(
          d.observacaoCliente
        )}</td></tr>`
      : ""
  }

  ${btnLink ? `<tr><td style="padding:22px 32px 4px">${btnLink}</td></tr>` : ""}

  <tr><td style="padding:22px 32px"><hr style="border:none;border-top:1px solid #f0f0f0;margin:0"></td></tr>
  <tr><td style="padding:0 32px 24px;text-align:center">
    <p style="margin:0;font-size:12px;color:#9ca3af">${esc(d.empresa.nome)} · ${esc(d.empresa.contato)}</p>
  </td></tr>

</table></td></tr></table></body></html>`;
}
