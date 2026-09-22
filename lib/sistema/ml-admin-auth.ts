import { createHash, randomBytes } from "node:crypto";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import type { MLTokenResponse } from "@/lib/sistema/ml-auth";

/**
 * OAuth do Mercado Livre da EMPRESA (não de um seller) — usado só pelo
 * admin/gerente em /sistema/estoque/produtos/importar-ml, pra puxar os
 * anúncios que a PH já tem publicados e virar produto da linha própria.
 * Independente do `ml-auth.ts` (portal dos sellers): tokens vivem em
 * `admin_ml_token`, sem vínculo com `clientes`.
 */

const ML_APP_ID = process.env.ML_APP_ID!;
const ML_SECRET = process.env.ML_CLIENT_SECRET!;
const ML_ADMIN_REDIRECT_URI = process.env.ML_REDIRECT_URI!;
const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

export interface AdminMlRecord {
  id: string;
  ml_user_id: string;
  ml_nickname: string | null;
  expires_at: string;
}

export function mlAdminConfigurado(): boolean {
  return !!(ML_APP_ID && ML_SECRET && ML_ADMIN_REDIRECT_URI);
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function codeChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** state = só o code_verifier (não precisa de id — é sempre a mesma conta da empresa). */
export function getAdminMlAuthUrl(): string {
  const codeVerifier = generateCodeVerifier();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: ML_APP_ID,
    redirect_uri: ML_ADMIN_REDIRECT_URI,
    state: codeVerifier,
    code_challenge: codeChallengeFromVerifier(codeVerifier),
    code_challenge_method: "S256",
    scope: "offline_access read write",
  });
  return `https://auth.mercadolivre.com.br/authorization?${params}`;
}

export async function exchangeAdminCodeForToken(code: string, codeVerifier: string): Promise<MLTokenResponse> {
  const res = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ML_APP_ID,
      client_secret: ML_SECRET,
      code,
      redirect_uri: ML_ADMIN_REDIRECT_URI,
      code_verifier: codeVerifier,
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
    console.error("[ml-admin-auth] token exchange failed:", res.status, JSON.stringify(err));
    throw new Error(msg);
  }
  return res.json();
}

async function refreshAdminAccessToken(refreshToken: string): Promise<MLTokenResponse> {
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

export async function saveAdminMlToken(token: MLTokenResponse, nickname?: string): Promise<void> {
  const db = await createSistemaAdminClient();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const { error } = await db.from("admin_ml_token").upsert(
    {
      ml_user_id: String(token.user_id),
      ml_nickname: nickname ?? null,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: expiresAt,
    },
    { onConflict: "ml_user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function getAdminMlRecord(): Promise<AdminMlRecord | null> {
  const db = await createSistemaAdminClient();
  const { data } = await db
    .from("admin_ml_token")
    .select("id, ml_user_id, ml_nickname, expires_at")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return (data as AdminMlRecord) ?? null;
}

export async function getValidAdminMlToken(): Promise<string> {
  const db = await createSistemaAdminClient();
  const { data } = await db
    .from("admin_ml_token")
    .select("access_token, refresh_token, expires_at")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data?.access_token) throw new Error("Conta do Mercado Livre da empresa não conectada");

  const expiresAt = data.expires_at ? new Date(data.expires_at as string) : null;
  const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (isExpired && data.refresh_token) {
    const refreshed = await refreshAdminAccessToken(data.refresh_token as string);
    await saveAdminMlToken(refreshed);
    return refreshed.access_token;
  }
  return data.access_token as string;
}

export async function disconnectAdminMl(id: string): Promise<void> {
  const db = await createSistemaAdminClient();
  const { error } = await db.from("admin_ml_token").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
