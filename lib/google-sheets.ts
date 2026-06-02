import { createSign } from "crypto";

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel de ambiente ausente: ${name}`);
  return value;
}

// Module-level token cache (lives for the duration of the Node.js process)
let _tokenCache: { token: string; expiresAt: number } | null = null;

function normalizePrivateKey(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n");
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload: object, privateKey: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  return `${data}.${base64Url(signer.sign(privateKey))}`;
}

export async function getGoogleAccessToken(): Promise<string> {
  const now = Date.now();
  if (_tokenCache && now < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  const clientEmail = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = normalizePrivateKey(env("GOOGLE_PRIVATE_KEY"));
  const nowSec = Math.floor(now / 1000);
  const assertion = signJwt(
    { iss: clientEmail, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", exp: nowSec + 3600, iat: nowSec },
    privateKey
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Auth Google: ${data.error_description ?? data.error}`);

  // Cache for 55 minutes (token lasts 60 min, keep 5 min buffer)
  _tokenCache = { token: data.access_token as string, expiresAt: now + 55 * 60 * 1000 };
  return _tokenCache.token;
}

// Simple in-process read cache to avoid hammering the Sheets API
const _readCache = new Map<string, { data: string[][]; expiresAt: number }>();
const READ_CACHE_TTL = 60_000; // 60 seconds

export async function sheetsRead(spreadsheetId: string, range: string, cacheTags?: string[]): Promise<string[][]> {
  const cacheKey = `${spreadsheetId}::${range}`;
  const cached = _readCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const accessToken = await getGoogleAccessToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(cacheTags ? { next: { tags: cacheTags, revalidate: 1800 } } : { cache: "no-store" }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets read: ${data.error?.message ?? res.statusText}`);
  const result = (data.values as string[][]) ?? [];

  _readCache.set(cacheKey, { data: result, expiresAt: Date.now() + READ_CACHE_TTL });
  return result;
}

export function invalidateReadCache(spreadsheetId: string, range: string): void {
  _readCache.delete(`${spreadsheetId}::${range}`);
}

export async function sheetsAppend(spreadsheetId: string, range: string, values: unknown[][]): Promise<void> {
  const accessToken = await getGoogleAccessToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets append: ${data.error?.message ?? res.statusText}`);
}

export async function sheetsUpdate(spreadsheetId: string, range: string, values: unknown[][]): Promise<void> {
  const accessToken = await getGoogleAccessToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets update: ${data.error?.message ?? res.statusText}`);
}

export async function getSheetId(spreadsheetId: string, sheetName: string): Promise<number> {
  const accessToken = await getGoogleAccessToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  const sheet = data.sheets?.find((s: { properties: { title: string; sheetId: number } }) => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada na planilha`);
  return sheet.properties.sheetId as number;
}

export async function sheetsDeleteRow(spreadsheetId: string, sheetName: string, sheetRowNumber: number): Promise<void> {
  const accessToken = await getGoogleAccessToken();
  const sheetId = await getSheetId(spreadsheetId, sheetName);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: sheetRowNumber - 1, endIndex: sheetRowNumber },
          },
        }],
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets delete: ${data.error?.message ?? res.statusText}`);
}
