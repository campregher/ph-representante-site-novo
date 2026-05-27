import { createSign } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { EMAIL } from "@/lib/constants";

export const runtime = "nodejs";

const leadSchema = z.object({
  name: z.string().min(2),
  company: z.string().optional(),
  cnpj: z.string().min(14),
  phone: z.string().min(10),
  email: z.string().email(),
  city: z.string().min(2),
  businessType: z.enum(["distribuidor", "loja", "seller-ml", "seller-shopee", "dropshipping"]),
  interest: z.enum(["atacado", "dropshipping", "gestao", "tudo"]),
  message: z.string().optional(),
});

type Lead = z.infer<typeof leadSchema>;

const businessTypeLabels: Record<Lead["businessType"], string> = {
  distribuidor: "Distribuidor",
  loja: "Loja / Autopecas",
  "seller-ml": "Seller Mercado Livre",
  "seller-shopee": "Seller Shopee",
  dropshipping: "Dropshipping",
};

const interestLabels: Record<Lead["interest"], string> = {
  atacado: "Atacado",
  dropshipping: "Dropshipping",
  gestao: "Gestao de Marketplace",
  tudo: "Todos os servicos",
};

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel de ambiente ausente: ${name}`);
  return value;
}

function normalizePrivateKey(value: string) {
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n");
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload: object, privateKey: string) {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${data}.${base64Url(signature)}`;
}

async function getGoogleAccessToken() {
  const clientEmail = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = normalizePrivateKey(env("GOOGLE_PRIVATE_KEY"));
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    },
    privateKey,
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Falha ao autenticar no Google: ${data.error_description ?? data.error ?? response.statusText}`);
  }
  return data.access_token as string;
}

async function appendLeadToSheet(lead: Lead) {
  const spreadsheetId = env("GOOGLE_SHEETS_SPREADSHEET_ID");
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || "Leads";
  const accessToken = await getGoogleAccessToken();
  const createdAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const values = [[
    createdAt,
    lead.name,
    lead.company || "",
    lead.cnpj,
    lead.phone,
    lead.email,
    lead.city,
    businessTypeLabels[lead.businessType],
    interestLabels[lead.interest],
    lead.message || "",
  ]];

  const range = encodeURIComponent(`${sheetName}!A:J`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Falha ao salvar no Google Sheets: ${data.error?.message ?? response.statusText}`);
  }
}

function emailHtml(lead: Lead) {
  const rows = [
    ["Nome", lead.name],
    ["Empresa", lead.company || "-"],
    ["CNPJ", lead.cnpj],
    ["WhatsApp", lead.phone],
    ["E-mail", lead.email],
    ["Cidade", lead.city],
    ["Tipo de negocio", businessTypeLabels[lead.businessType]],
    ["Interesse", interestLabels[lead.interest]],
    ["Mensagem", lead.message || "-"],
  ];

  return `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
      <h2>Novo lead - PH Representante</h2>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:680px">
        ${rows.map(([label, value]) => `
          <tr>
            <td style="border:1px solid #ddd;background:#f7f7f7;font-weight:bold;width:180px">${label}</td>
            <td style="border:1px solid #ddd">${value}</td>
          </tr>
        `).join("")}
      </table>
    </div>
  `;
}

const WHATSAPP_LINK = "https://wa.me/5511959993968";
const DRIVE_LINK = "https://drive.google.com/drive/folders/1LFn8Y-IiD7cD6A3d3L12YiB91ClWiQph";

const interestContent: Record<Lead["interest"], { title: string; steps: string[]; showDrive: boolean }> = {
  atacado: {
    title: "Como funciona o Atacado PH Representante",
    steps: [
      "Você escolhe os produtos do nosso catálogo de acessórios automotivos (tapetes, calhas, frisos e mais).",
      "Fazemos seu cadastro como cliente atacadista com condições exclusivas de preço e prazo.",
      "Você compra em volume, mantém o estoque na sua loja ou depósito e revende com sua margem.",
      "Entrega para todo o Brasil com rastreamento e suporte comercial dedicado.",
    ],
    showDrive: true,
  },
  dropshipping: {
    title: "Como funciona o Dropshipping PH Representante",
    steps: [
      "Você anuncia os produtos das representadas no Mercado Livre, Shopee ou qualquer marketplace — sem precisar de estoque.",
      "Quando o cliente compra, você repassa o pedido junto com a etiqueta com o SKU do produto.",
      "As representadas recebem os pedidos com as etiquetas, separam, embalam e postam no ponto de coleta mais próximo com destino ao consumidor final.",
      "Os valores de custo dos produtos são repassados às representadas, que faturam os pedidos diariamente ou semanalmente — dependendo do fornecedor.",
    ],
    showDrive: true,
  },
  gestao: {
    title: "Como funciona a Gestão de Marketplace",
    steps: [
      "Realizamos um diagnóstico completo da sua conta no Mercado Livre ou Shopee.",
      "Criamos e otimizamos seus anúncios com fotos profissionais, títulos com SEO e descrições persuasivas.",
      "Gerenciamos suas campanhas de anúncios pagos (ML Ads / Shopee Ads) com foco em ROAS.",
      "Você acompanha relatórios mensais de desempenho, faturamento e oportunidades de crescimento.",
    ],
    showDrive: false,
  },
  tudo: {
    title: "Conheça todos os serviços PH Representante",
    steps: [
      "🛒 Atacado: compre nosso catálogo completo de acessórios automotivos com preços exclusivos para revendedores.",
      "📦 Dropshipping: venda sem estoque — você anuncia, repassa o pedido com a etiqueta SKU e as representadas cuidam do envio ao cliente final.",
      "📊 Gestão de Marketplace: cuidamos de toda a operação da sua conta no Mercado Livre e Shopee.",
      "🎯 Consultoria: mentoria estratégica para sellers que querem crescer e profissionalizar a operação.",
    ],
    showDrive: true,
  },
};

function btn(href: string, label: string, color = "#e11d48") {
  return `
    <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;background:${color};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:50px;margin:6px 8px 6px 0">
      ${label}
    </a>`;
}

function welcomeEmailHtml(lead: Lead) {
  const content = interestContent[lead.interest];
  const firstName = lead.name.split(" ")[0];

  const stepsHtml = content.steps.map((step, i) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top">
        <span style="display:inline-block;width:28px;height:28px;background:#fff1f2;color:#e11d48;font-weight:700;font-size:13px;border-radius:50%;text-align:center;line-height:28px;margin-right:12px;flex-shrink:0">${i + 1}</span>
        <span style="font-size:15px;color:#374151;line-height:1.6">${step}</span>
      </td>
    </tr>`).join("");

  const driveButtons = content.showDrive ? `
    ${btn(DRIVE_LINK, "📋 Baixar Catálogo", "#e11d48")}
    ${btn(DRIVE_LINK, "💰 Ver Tabela de Preços", "#111827")}` : "";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#e11d48;padding:32px 40px;text-align:center">
            <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">PH Representante</p>
            <p style="margin:6px 0 0;font-size:13px;color:#fecdd3">Acessórios Automotivos · Atacado · Dropshipping</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:36px 40px 0">
            <p style="margin:0;font-size:24px;font-weight:800;color:#111827">Olá, ${firstName}! 👋</p>
            <p style="margin:12px 0 0;font-size:16px;color:#6b7280;line-height:1.6">
              Recebemos seu cadastro e ficamos felizes com seu interesse. Nossa equipe já foi notificada e entrará em contato em breve.
            </p>
            <p style="margin:10px 0 0;font-size:16px;color:#6b7280;line-height:1.6">
              Enquanto isso, preparamos um resumo de tudo que você precisa saber:
            </p>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="padding:28px 40px 0">
            <p style="margin:0 0 16px;font-size:18px;font-weight:800;color:#111827">${content.title}</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${stepsHtml}
            </table>
          </td>
        </tr>

        <!-- CTAs -->
        <tr>
          <td style="padding:32px 40px">
            <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#374151">Próximos passos:</p>
            ${btn(WHATSAPP_LINK, "💬 Falar no WhatsApp", "#16a34a")}
            ${driveButtons}
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px"><hr style="border:none;border-top:1px solid #f0f0f0;margin:0"></td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;text-align:center">
            <p style="margin:0;font-size:13px;color:#9ca3af">PH Representante · São Paulo, SP</p>
            <p style="margin:6px 0 0;font-size:13px;color:#9ca3af">contato@phrepresentante.com.br · (11) 5999-3968</p>
            <p style="margin:12px 0 0;font-size:12px;color:#d1d5db">Você está recebendo este e-mail porque preencheu o formulário de contato em phrepresentante.com.br</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendWelcomeEmail(lead: Lead) {
  const apiKey = env("RESEND_API_KEY");
  const from = process.env.RESEND_FROM_EMAIL || "PH Representante <onboarding@resend.dev>";

  const subject = "Bem-vindo à PH Representante!";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: lead.email,
      subject,
      html: welcomeEmailHtml(lead),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Falha ao enviar e-mail de boas-vindas: ${data.message ?? response.statusText}`);
  }
}

async function sendNotificationEmail(lead: Lead) {
  const apiKey = env("RESEND_API_KEY");
  const from = process.env.RESEND_FROM_EMAIL || "PH Representante <onboarding@resend.dev>";
  const to = process.env.LEAD_NOTIFICATION_EMAIL || EMAIL;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: lead.email,
      subject: `Novo lead do site: ${lead.name}`,
      html: emailHtml(lead),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Falha ao enviar e-mail pelo Resend: ${data.message ?? response.statusText}`);
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const lead = leadSchema.parse(json);

    await appendLeadToSheet(lead);
    await Promise.all([
      sendNotificationEmail(lead),
      sendWelcomeEmail(lead),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Erro inesperado ao processar contato";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
