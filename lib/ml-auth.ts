import { createAdminClient } from "@/lib/supabase/server";

const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

export const ML_APP_ID      = process.env.ML_APP_ID!;
export const ML_SECRET      = process.env.ML_CLIENT_SECRET!;
export const ML_REDIRECT_URI = process.env.ML_REDIRECT_URI!;

export function getMlAuthUrl(marcaSlug: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     ML_APP_ID,
    redirect_uri:  ML_REDIRECT_URI,
    state:         marcaSlug,
  });
  return `https://auth.mercadolivre.com.br/authorization?${params}`;
}

export async function exchangeCodeForToken(code: string) {
  const res = await fetch(ML_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     ML_APP_ID,
      client_secret: ML_SECRET,
      code,
      redirect_uri:  ML_REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description ?? "Falha ao trocar code por token");
  }
  return res.json() as Promise<MLTokenResponse>;
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(ML_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     ML_APP_ID,
      client_secret: ML_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description ?? "Falha ao renovar token");
  }
  return res.json() as Promise<MLTokenResponse>;
}

export async function saveMlToken(marcaSlug: string, token: MLTokenResponse) {
  const db = await createAdminClient();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const { error } = await db
    .from("marcas")
    .update({
      ml_user_id:          String(token.user_id),
      ml_access_token:     token.access_token,
      ml_refresh_token:    token.refresh_token,
      ml_token_expires_at: expiresAt,
    })
    .eq("slug", marcaSlug);
  if (error) throw new Error(error.message);
}

export async function getValidToken(marcaSlug: string): Promise<string> {
  const db = await createAdminClient();
  const { data, error } = await db
    .from("marcas")
    .select("ml_access_token, ml_refresh_token, ml_token_expires_at")
    .eq("slug", marcaSlug)
    .single();

  if (error || !data?.ml_access_token) throw new Error("Marca não conectada ao Mercado Livre");

  const expiresAt = data.ml_token_expires_at ? new Date(data.ml_token_expires_at) : null;
  const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (isExpired && data.ml_refresh_token) {
    const refreshed = await refreshAccessToken(data.ml_refresh_token);
    await saveMlToken(marcaSlug, refreshed);
    return refreshed.access_token;
  }

  return data.ml_access_token;
}

export async function disconnectMl(marcaSlug: string) {
  const db = await createAdminClient();
  const { error } = await db
    .from("marcas")
    .update({
      ml_user_id:          null,
      ml_access_token:     null,
      ml_refresh_token:    null,
      ml_token_expires_at: null,
    })
    .eq("slug", marcaSlug);
  if (error) throw new Error(error.message);
}

export interface MLTokenResponse {
  access_token:  string;
  token_type:    string;
  expires_in:    number;
  scope:         string;
  user_id:       number;
  refresh_token: string;
}
