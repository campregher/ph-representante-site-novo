"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient, createSistemaAdminClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import type { Role } from "@/lib/sistema/roles";
import type { ActionResult } from "@/lib/sistema/types";

const ROLES: Role[] = ["admin", "gerente", "vendedor", "financeiro", "consulta"];

async function guardAdmin() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (profile.role !== "admin")
    return { profile: null, error: "Apenas administradores podem gerenciar usuários." as const };
  return { profile, error: null };
}

function senhaProvisoria(): string {
  const s = Math.random().toString(36).slice(2, 10);
  return `PH-${s}${Math.floor(10 + Math.random() * 89)}`;
}

export async function criarUsuario(input: {
  email: string;
  nome: string;
  role: string;
}): Promise<ActionResult<{ senha?: string }>> {
  const g = await guardAdmin();
  if (g.error) return { ok: false, error: g.error };

  const email = input.email.trim().toLowerCase();
  const nome = input.nome.trim();
  const role = (ROLES as string[]).includes(input.role) ? input.role : "consulta";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "E-mail inválido." };
  if (nome.length < 2) return { ok: false, error: "Informe o nome." };

  const admin = await createSistemaAdminClient();
  const senha = senhaProvisoria();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error) return { ok: false, error: error.message };
  const uid = data.user?.id;
  if (!uid) return { ok: false, error: "Falha ao criar usuário." };

  // o trigger cria o profile; garante nome/role/ativo
  await admin.from("profiles").update({ nome, role, ativo: true }).eq("id", uid);

  revalidatePath("/sistema/configuracoes");
  return { ok: true, senha };
}

export async function atualizarUsuario(
  id: string,
  patch: { role?: string; ativo?: boolean; nome?: string }
): Promise<ActionResult> {
  const g = await guardAdmin();
  if (g.error) return { ok: false, error: g.error };

  if (id === g.profile!.id && (patch.role && patch.role !== "admin"))
    return { ok: false, error: "Você não pode remover seu próprio acesso de administrador." };
  if (id === g.profile!.id && patch.ativo === false)
    return { ok: false, error: "Você não pode desativar a si mesmo." };

  const dados: Record<string, unknown> = {};
  if (patch.role && (ROLES as string[]).includes(patch.role)) dados.role = patch.role;
  if (typeof patch.ativo === "boolean") dados.ativo = patch.ativo;
  if (patch.nome && patch.nome.trim().length >= 2) dados.nome = patch.nome.trim();
  if (Object.keys(dados).length === 0) return { ok: true };

  const supabase = await createSistemaClient();
  const { error } = await supabase.from("profiles").update(dados).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sistema/configuracoes");
  revalidatePath("/sistema", "layout");
  return { ok: true };
}

export async function enviarResetSenha(email: string): Promise<ActionResult> {
  const g = await guardAdmin();
  if (g.error) return { ok: false, error: g.error };
  const admin = await createSistemaAdminClient();
  const { error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
