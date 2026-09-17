import { NextResponse } from "next/server";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { exchangePortalCodeForToken, saveMlToken, parseAuthState } from "@/lib/sistema/ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ML redireciona pra cá após o seller autorizar. state = "cliente_id.code_verifier" (PKCE). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawState = searchParams.get("state");
  const parsed = rawState ? parseAuthState(rawState) : null;

  if (!code || !parsed || !UUID_RE.test(parsed.clienteId)) {
    console.error("[drop/ml/callback] parâmetros inválidos:", { code: !!code, state: rawState });
    return NextResponse.redirect(new URL("/drop/erro?e=ml_auth", request.url));
  }
  const { clienteId, codeVerifier } = parsed;

  const db = await createSistemaAdminClient();
  const { data: cliente } = await db
    .from("clientes")
    .select("portal_token")
    .eq("id", clienteId)
    .maybeSingle();
  if (!cliente) return NextResponse.redirect(new URL("/drop/erro?e=ml_auth", request.url));

  const portalUrl = new URL(`/drop/portal/${cliente.portal_token}`, request.url);

  try {
    const token = await exchangePortalCodeForToken(code, codeVerifier);

    let nickname: string | undefined;
    try {
      const me = await fetch(`${ML_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (me.ok) {
        const data = await me.json();
        nickname = data.nickname ?? data.first_name ?? undefined;
      }
    } catch {
      /* nickname é só cosmético */
    }

    await saveMlToken(clienteId, token, nickname);
    portalUrl.searchParams.set("ml", "conectado");
    return NextResponse.redirect(portalUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[drop/ml/callback] erro ao trocar token:", msg);
    portalUrl.searchParams.set("ml", "erro");
    portalUrl.searchParams.set("detalhe", msg.slice(0, 150));
    return NextResponse.redirect(portalUrl);
  }
}
