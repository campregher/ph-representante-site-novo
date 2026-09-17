import { createSistemaAdminClient } from "@/lib/supabase/server";

/**
 * OAuth do Mercado Livre para o portal do seller (dropshipping).
 * Adaptado de `lib/portal-ml-auth.ts` (removido no commit 63c1fd9 junto com
 * a antiga área /portal) — agora usa `comercial.clientes` /
 * `comercial.cliente_ml_tokens` em vez de `auth.users` / `public.portal_ml_tokens`.
 */

const ML_APP_ID = process.env.ML_APP_ID!;
const ML_SECRET = process.env.ML_CLIENT_SECRET!;
const ML_PORTAL_REDIRECT_URI = process.env.ML_PORTAL_REDIRECT_URI!;
const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

export interface MLTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

export function mlConfigurado(): boolean {
  return !!(ML_APP_ID && ML_SECRET && ML_PORTAL_REDIRECT_URI);
}

/** state carrega o cliente_id — o callback do ML não preserva sessão/cookies. */
export function getPortalMlAuthUrl(clienteId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: ML_APP_ID,
    redirect_uri: ML_PORTAL_REDIRECT_URI,
    state: clienteId,
    scope: "offline_access read write orders",
  });
  return `https://auth.mercadolivre.com.br/authorization?${params}`;
}

export async function exchangePortalCodeForToken(code: string): Promise<MLTokenResponse> {
  const res = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ML_APP_ID,
      client_secret: ML_SECRET,
      code,
      redirect_uri: ML_PORTAL_REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    let err: Record<string, string> = {};
    try {
      err = await res.json();
    } catch {
      /* noop */
    }
    const msg = err.error_description ?? err.message ?? err.error ?? `HTTP ${res.status}`;
    console.error("[ml-auth] token exchange failed:", res.status, JSON.stringify(err));
    throw new Error(msg);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<MLTokenResponse> {
  const res = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: ML_APP_ID,
      client_secret: ML_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description ?? "Falha ao renovar token do Mercado Livre");
  }
  return res.json();
}

export async function saveMlToken(
  clienteId: string,
  token: MLTokenResponse,
  nickname?: string
): Promise<void> {
  const db = await createSistemaAdminClient();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const { error } = await db.from("cliente_ml_tokens").upsert(
    {
      cliente_id: clienteId,
      ml_user_id: String(token.user_id),
      ml_nickname: nickname ?? null,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: expiresAt,
    },
    { onConflict: "cliente_id" }
  );
  if (error) throw new Error(error.message);
}

/** Retorna um access_token válido, renovando via refresh_token se necessário. */
export async function getValidMlToken(clienteId: string): Promise<string> {
  const db = await createSistemaAdminClient();
  const { data } = await db
    .from("cliente_ml_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("cliente_id", clienteId)
    .maybeSingle();

  if (!data?.access_token) throw new Error("Conta do Mercado Livre não conectada");

  const expiresAt = data.expires_at ? new Date(data.expires_at as string) : null;
  const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (isExpired && data.refresh_token) {
    const refreshed = await refreshAccessToken(data.refresh_token as string);
    await saveMlToken(clienteId, refreshed);
    return refreshed.access_token;
  }
  return data.access_token as string;
}

export async function getMlRecord(
  clienteId: string
): Promise<{ ml_user_id: string; ml_nickname: string | null; expires_at: string } | null> {
  const db = await createSistemaAdminClient();
  const { data } = await db
    .from("cliente_ml_tokens")
    .select("ml_user_id, ml_nickname, expires_at")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  return (data as { ml_user_id: string; ml_nickname: string | null; expires_at: string }) ?? null;
}

export async function disconnectMl(clienteId: string): Promise<void> {
  const db = await createSistemaAdminClient();
  const { error } = await db.from("cliente_ml_tokens").delete().eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);
}
