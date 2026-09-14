import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSistemaClient } from "@/lib/supabase/server";
import type { Role } from "./roles";

export type { Role } from "./roles";
export { ROLE_LABEL, ROLE_OPTIONS, canManage, canFinance } from "./roles";

export interface SistemaProfile {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  avatar_url: string | null;
  role: Role;
  ativo: boolean;
}

const PROFILE_COLS = "id, nome, email, telefone, avatar_url, role, ativo";

/**
 * Usuário autenticado (via cookie, validado contra o Auth do Supabase) + profile
 * cru (ativo ou não). `cache()` do React dedupa isso DENTRO da mesma requisição —
 * o layout de /sistema e a página chamavam isso em duplicidade (2x getUser() na
 * rede + 2x query de profile por navegação); agora roda só uma vez.
 */
export const getAuthedUserAndProfile = cache(async (): Promise<{
  user: User | null;
  profile: SistemaProfile | null;
}> => {
  const supabase = await createSistemaClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: (data as SistemaProfile) ?? null };
});

/** Profile do usuário logado, ou null se não houver sessão ou profile ativo. */
export async function getSistemaProfile(): Promise<SistemaProfile | null> {
  const { profile } = await getAuthedUserAndProfile();
  if (!profile || !profile.ativo) return null;
  return profile;
}

/** Exige login + profile ativo. Redireciona caso contrário. Use no topo de páginas server. */
export async function requireSistemaProfile(): Promise<SistemaProfile> {
  const { user, profile } = await getAuthedUserAndProfile();
  // sem sessão → login;  com sessão mas sem profile ativo → acesso-negado
  // (nunca redireciona para "/sistema": isso causava loop infinito)
  if (!user) redirect("/login?redirect=/sistema");
  if (!profile || !profile.ativo) redirect("/sistema/acesso-negado");
  return profile;
}

/** Exige um dos papéis informados. */
export async function requireRole(...roles: Role[]): Promise<SistemaProfile> {
  const profile = await requireSistemaProfile();
  if (!roles.includes(profile.role)) redirect("/sistema/acesso-negado");
  return profile;
}
