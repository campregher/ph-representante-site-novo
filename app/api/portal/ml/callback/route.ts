import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangePortalCodeForToken,
  savePortalMlToken,
} from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state"); // clienteId enviado no /connect

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== state) {
    return NextResponse.redirect(new URL("/portal/mercadolivre?error=auth", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/portal/mercadolivre?error=no_code", request.url));
  }

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

    await savePortalMlToken(user.id, token, nickname);

    return NextResponse.redirect(new URL("/portal/mercadolivre?connected=1", request.url));
  } catch (e) {
    console.error("ML portal callback error:", e);
    return NextResponse.redirect(new URL("/portal/mercadolivre?error=token", request.url));
  }
}
