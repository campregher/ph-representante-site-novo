import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  // ── Admin routes ──────────────────────────────────────────
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!token || !(await verifyToken(token))) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // ── Portal routes ─────────────────────────────────────────
  if (pathname.startsWith("/portal")) {
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

    const { data: { user } } = await supabase.auth.getUser();

    const isPublicPortal =
      pathname.startsWith("/portal/login") ||
      pathname.startsWith("/portal/registro") ||
      pathname.startsWith("/portal/recuperar-senha") ||
      pathname.startsWith("/portal/nova-senha");

    if (!user && !isPublicPortal) {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }

    // nova-senha needs an active session to call updateUser — don't redirect away
    if (user && isPublicPortal && !pathname.startsWith("/portal/nova-senha")) {
      return NextResponse.redirect(new URL("/portal/dashboard", request.url));
    }
  }

  // ── Marca routes ─────────────────────────────────────────
  if (pathname.startsWith("/marca")) {
    const supabaseMarca = createServerClient(
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

    const { data: { user: marcaUser } } = await supabaseMarca.auth.getUser();

    const isPublicMarca =
      pathname.startsWith("/marca/login") ||
      pathname.startsWith("/marca/recuperar-senha") ||
      pathname.startsWith("/marca/nova-senha");

    if (!marcaUser && !isPublicMarca) {
      return NextResponse.redirect(new URL("/marca/login", request.url));
    }

    // nova-senha needs an active session to call updateUser — don't redirect away
    if (marcaUser && isPublicMarca && !pathname.startsWith("/marca/nova-senha")) {
      return NextResponse.redirect(new URL("/marca/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/marca/:path*"],
};
