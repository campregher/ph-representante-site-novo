import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCodeVerifier, generateCodeChallenge, getPortalMlAuthUrl } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const codeVerifier  = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const authUrl       = getPortalMlAuthUrl(user.id, codeChallenge);

  const res = NextResponse.redirect(authUrl);

  /* armazena o code_verifier em cookie HTTP-only para usar no callback */
  res.cookies.set("ml_pkce_verifier", codeVerifier, {
    httpOnly: true,
    secure:   true,
    sameSite: "lax",
    maxAge:   600, // 10 minutos
    path:     "/",
  });

  return res;
}
