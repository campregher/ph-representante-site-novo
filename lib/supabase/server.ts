import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Admin (service_role) no schema `public`.
 * Usado pelo catálogo público (`lib/produtos.ts`). NÃO alterar o comportamento.
 */
export async function createAdminClient() {
  return createSupabaseClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cliente SSR ligado à sessão do usuário (cookies), schema `comercial`.
 * RLS é aplicada — use em Server Components / Server Actions / Route Handlers
 * da área /sistema.
 */
export async function createSistemaClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, ANON_KEY, {
    db: { schema: "comercial" },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // chamado de um Server Component — ignorável, o middleware renova a sessão
        }
      },
    },
  });
}

/**
 * Admin (service_role) no schema `comercial`, sem sessão.
 * Ignora RLS — use SOMENTE no servidor para agregações/relatórios que
 * precisam varrer todos os registros.
 */
export async function createSistemaAdminClient() {
  return createSupabaseClient(SUPABASE_URL, SERVICE_KEY, {
    db: { schema: "comercial" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
