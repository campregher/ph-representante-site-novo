import { NextResponse } from "next/server";
import { requireRole } from "@/lib/sistema/auth";
import { exchangeAdminCodeForToken, saveAdminMlToken } from "@/lib/sistema/ml-admin-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

/** ML redireciona pra cá após o admin autorizar. state = code_verifier (PKCE). */
export async function GET(request: Request) {
  await requireRole("admin", "gerente");

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const codeVerifier = searchParams.get("state");
  const redirectUrl = new URL("/sistema/estoque/produtos/importar-ml", request.url);

  if (!code || !codeVerifier) {
    redirectUrl.searchParams.set("ml", "erro");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const token = await exchangeAdminCodeForToken(code, codeVerifier);

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

    await saveAdminMlToken(token, nickname);
    redirectUrl.searchParams.set("ml", "conectado");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sistema/ml/callback] erro ao trocar token:", msg);
    redirectUrl.searchParams.set("ml", "erro");
    redirectUrl.searchParams.set("detalhe", msg.slice(0, 150));
  }
  return NextResponse.redirect(redirectUrl);
}
