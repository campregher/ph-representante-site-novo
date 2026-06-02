import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

// Supabase PKCE auth callback — troca o code por uma sessão
// Configurar em Supabase → Auth → URL Configuration → Redirect URLs:
//   https://seudominio.com/auth/callback

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) => {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Algo deu errado — redireciona para login com mensagem de erro
  const errorUrl = next.startsWith("/marca")
    ? `${origin}/marca/login?error=link_expired`
    : `${origin}/portal/login?error=link_expired`;

  return NextResponse.redirect(errorUrl);
}
