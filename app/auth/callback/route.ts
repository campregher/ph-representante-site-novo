import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

/**
 * Callback de e-mails do Supabase Auth (recuperação de senha / convite / magic link).
 * O template envia: /auth/callback?token_hash=...&type=recovery&next=/nova-senha
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/sistema";
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "recovery"
    | "invite"
    | "signup"
    | "magiclink"
    | "email"
    | null;

  const errorUrl = `${origin}/login?error=link_invalido`;

  if (!tokenHash || !type) {
    return NextResponse.redirect(errorUrl);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return NextResponse.redirect(errorUrl);
  }

  return response;
}
