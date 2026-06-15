import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangePortalCodeForToken,
  savePortalMlToken,
} from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state"); // user.id enviado no /connect

  if (!code) {
    console.error("[ml/callback] sem code:", Object.fromEntries(searchParams));
    return NextResponse.redirect(new URL("/portal/mercadolivre?error=no_code", request.url));
  }

  /* state deve ser um UUID válido (user.id) */
  if (!state || !UUID_RE.test(state)) {
    console.error("[ml/callback] state inválido:", state);
    return NextResponse.redirect(new URL("/portal/mercadolivre?error=auth", request.url));
  }

  /* valida sessão — mas usa state como fallback se sessão não disponível */
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  /* se sessão existe, garante que é o mesmo usuário */
  if (user && user.id !== state) {
    console.error("[ml/callback] user.id !== state", user.id, state);
    return NextResponse.redirect(new URL("/portal/mercadolivre?error=auth", request.url));
  }

  /* clienteId: prefere sessão ativa, cai no state se sessão expirou durante o redirect */
  const clienteId = user?.id ?? state;

  try {
    const token = await exchangePortalCodeForToken(code);

    /* busca nickname do vendedor */
    let nickname: string | undefined;
    try {
      const me = await fetch(`${ML_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (me.ok) {
        const data = await me.json();
        nickname = data.nickname ?? data.first_name ?? undefined;
      }
    } catch { /* opcional */ }

    await savePortalMlToken(clienteId, token, nickname);

    return NextResponse.redirect(new URL("/portal/mercadolivre?connected=1", request.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ml/callback] erro ao trocar token:", msg);
    const dest = new URL("/portal/mercadolivre", request.url);
    dest.searchParams.set("error", "token");
    dest.searchParams.set("detail", msg.slice(0, 120));
    return NextResponse.redirect(dest);
  }
}
