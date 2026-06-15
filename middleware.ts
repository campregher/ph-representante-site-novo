import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";

// Rotas públicas que não precisam de autenticação
const MARCA_PUBLIC  = ["/marca/login", "/marca/recuperar-senha", "/marca/nova-senha"];
const PORTAL_PUBLIC = ["/portal/login", "/portal/registro", "/portal/recuperar-senha", "/portal/nova-senha"];
const ADMIN_PUBLIC  = ["/admin/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Proteção do admin (cookie HMAC, não Supabase) ───────────────────────────
  if (pathname.startsWith("/admin") && !ADMIN_PUBLIC.some(p => pathname.startsWith(p))) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value ?? "";
    const ok = await verifyToken(token);
    if (!ok) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // ── Proteção das rotas de marca e portal (Supabase session) ─────────────────
  const needsAuth =
    (pathname.startsWith("/marca")  && !MARCA_PUBLIC.some(p  => pathname.startsWith(p)))  ||
    (pathname.startsWith("/portal") && !PORTAL_PUBLIC.some(p => pathname.startsWith(p)));

  if (!needsAuth) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = pathname.startsWith("/marca") ? "/marca/login" : "/portal/login";
    return NextResponse.redirect(new URL(loginUrl, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/marca/:path*",
    "/portal/:path*",
  ],
};
