import { createAdminClient } from "@/lib/supabase/server";
import { ML_APP_ID, ML_SECRET, refreshAccessToken, MLTokenResponse } from "@/lib/ml-auth";

const ML_PORTAL_REDIRECT_URI = process.env.ML_PORTAL_REDIRECT_URI!;

export function getPortalMlAuthUrl(clienteId: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     ML_APP_ID,
    redirect_uri:  ML_PORTAL_REDIRECT_URI,
    state:         clienteId,
    scope:         "offline_access read write orders",
  });
  return `https://auth.mercadolivre.com.br/authorization?${params}`;
}

export async function exchangePortalCodeForToken(code: string) {
  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     ML_APP_ID,
      client_secret: ML_SECRET,
      code,
      redirect_uri:  ML_PORTAL_REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    let err: Record<string, string> = {};
    try { err = await res.json(); } catch { /* noop */ }
    const msg = err.error_description ?? err.message ?? err.error ?? `HTTP ${res.status}`;
    console.error("[portal-ml] token exchange failed:", res.status, JSON.stringify(err));
    throw new Error(msg);
  }
  return res.json() as Promise<MLTokenResponse>;
}

export async function savePortalMlToken(clienteId: string, token: MLTokenResponse, nickname?: string) {
  const db = await createAdminClient();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const { error } = await db
    .from("portal_ml_tokens")
    .upsert({
      cliente_id:    clienteId,
      ml_user_id:    String(token.user_id),
      ml_nickname:   nickname ?? null,
      access_token:  token.access_token,
      refresh_token: token.refresh_token,
      expires_at:    expiresAt,
      updated_at:    new Date().toISOString(),
    }, { onConflict: "cliente_id" });
  if (error) throw new Error(error.message);
}

export async function getValidPortalToken(clienteId: string): Promise<string> {
  const db = await createAdminClient();
  const { data, error } = await db
    .from("portal_ml_tokens")
    .select("access_token, refresh_token, expires_at, ml_user_id")
    .eq("cliente_id", clienteId)
    .single();

  if (error || !data?.access_token) throw new Error("Conta ML não conectada");

  const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
  const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (isExpired && data.refresh_token) {
    const refreshed = await refreshAccessToken(data.refresh_token);
    await savePortalMlToken(clienteId, refreshed);
    return refreshed.access_token;
  }

  return data.access_token;
}

export async function getPortalMlRecord(clienteId: string) {
  const db = await createAdminClient();
  const { data } = await db
    .from("portal_ml_tokens")
    .select("ml_user_id, ml_nickname, expires_at")
    .eq("cliente_id", clienteId)
    .single();
  return data ?? null;
}

export async function disconnectPortalMl(clienteId: string) {
  const db = await createAdminClient();
  const { error } = await db
    .from("portal_ml_tokens")
    .delete()
    .eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);
}
