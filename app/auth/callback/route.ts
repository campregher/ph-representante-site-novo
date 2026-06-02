import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next       = searchParams.get("next") ?? "/";
  const tokenHash  = searchParams.get("token_hash");
  const type       = searchParams.get("type") as "recovery" | "invite" | "signup" | "magiclink" | null;

  const errorUrl = next.startsWith("/marca")
    ? `${origin}/marca/login?error=link_expired`
    : `${origin}/portal/login?error=link_expired`;

  // Debug: mostra todos os params recebidos
  if (!tokenHash || !type) {
    const allParams = searchParams.toString();
    return NextResponse.redirect(`${errorUrl}&debug=missing_params&params=${encodeURIComponent(allParams)}`);
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
    const debug = `${errorUrl}&msg=${encodeURIComponent(error.message)}&th=${tokenHash.slice(0,8)}&t=${type}`;
    return NextResponse.redirect(debug);
  }

  return response;
}
