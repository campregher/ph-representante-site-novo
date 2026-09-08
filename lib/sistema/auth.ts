import { redirect } from "next/navigation";
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

/** Profile do usuário logado, ou null se não houver sessão ou profile ativo. */
export async function getSistemaProfile(): Promise<SistemaProfile | null> {
  const supabase = await createSistemaClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", user.id)
    .maybeSingle();

  if (!data || !data.ativo) return null;
  return data as SistemaProfile;
}

/** Exige login + profile ativo. Redireciona caso contrário. Use no topo de páginas server. */
export async function requireSistemaProfile(): Promise<SistemaProfile> {
  const profile = await getSistemaProfile();
  if (!profile) redirect("/sistema");
  return profile;
}

/** Exige um dos papéis informados. */
export async function requireRole(...roles: Role[]): Promise<SistemaProfile> {
  const profile = await requireSistemaProfile();
  if (!roles.includes(profile.role)) redirect("/sistema/acesso-negado");
  return profile;
}
