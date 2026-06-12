import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, saveMlToken } from "@/lib/ml-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state"); // marcaSlug
  const error = searchParams.get("error");

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${req.headers.get("host")}`;

  if (error) {
    return NextResponse.redirect(
      `${base}/marca/perfil?ml_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${base}/marca/perfil?ml_error=missing_params`);
  }

  try {
    const token = await exchangeCodeForToken(code);
    await saveMlToken(state, token);

    /* busca nickname do vendedor para exibir no perfil */
    try {
      const userRes = await fetch(
        `https://api.mercadolibre.com/users/${token.user_id}`,
        { headers: { Authorization: `Bearer ${token.access_token}` } }
      );
      if (userRes.ok) {
        const userInfo = await userRes.json();
        const nickname = userInfo.nickname ?? userInfo.first_name ?? null;
        if (nickname) {
          const db = await createAdminClient();
          await db.from("marcas").update({ ml_nickname: nickname }).eq("slug", state);
        }
      }
    } catch { /* não bloqueia o fluxo se falhar */ }

    return NextResponse.redirect(`${base}/marca/perfil?ml_connected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.redirect(
      `${base}/marca/perfil?ml_error=${encodeURIComponent(msg)}`
    );
  }
}
