import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";

function makeSupabaseClient(request: NextRequest, response: NextResponse) {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next({ request });

  // ── Admin routes ──────────────────────────────────────────
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value ?? "";
    if (!(await verifyToken(token))) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // ── Portal routes ─────────────────────────────────────────
  if (pathname.startsWith("/portal")) {
    const isPublicPortal =
      pathname.startsWith("/portal/login") ||
      pathname.startsWith("/portal/registro") ||
      pathname.startsWith("/portal/recuperar-senha") ||
      pathname.startsWith("/portal/nova-senha");

    const supabase = makeSupabaseClient(request, response);
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user && !isPublicPortal) {
          return NextResponse.redirect(new URL("/portal/login", request.url));
        }
        if (user && isPublicPortal && !pathname.startsWith("/portal/nova-senha")) {
          return NextResponse.redirect(new URL("/portal/dashboard", request.url));
        }
      } catch { /* se Supabase falhar, deixa passar — a página lida com auth */ }
    }
  }

  // ── Marca routes ─────────────────────────────────────────
  if (pathname.startsWith("/marca")) {
    const isPublicMarca =
      pathname.startsWith("/marca/login") ||
      pathname.startsWith("/marca/recuperar-senha") ||
      pathname.startsWith("/marca/nova-senha");

    const supabase = makeSupabaseClient(request, response);
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user && !isPublicMarca) {
          return NextResponse.redirect(new URL("/marca/login", request.url));
        }
        if (user && isPublicMarca && !pathname.startsWith("/marca/nova-senha")) {
          return NextResponse.redirect(new URL("/marca/dashboard", request.url));
        }
      } catch { /* se Supabase falhar, deixa passar — a página lida com auth */ }
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/marca/:path*"],
};
