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
    await sendNotificationEmail(lead);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Erro inesperado ao processar contato";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
