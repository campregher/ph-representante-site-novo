"use server";

import { revalidatePath } from "next/cache";
import { createDropshippingAdminClient, createSistemaAdminClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { criarNotificacoes } from "@/lib/sistema/notificacoes";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import type { ActionResult } from "@/lib/sistema/types";

/**
 * Seller reporta um problema na plataforma direto do portal (botão
 * "Reportar problema" no menu) — monitoramento de erros relatados por
 * seller. Sempre resolve o cliente pela sessão autenticada (requireSeller),
 * nunca por um id vindo do client. Avisa os gestores (entra no resumo de
 * notificações já existente, ver notificacoes.ts).
 */
export async function reportarProblema(titulo: string, descricao: string, pagina: string): Promise<ActionResult> {
  const seller = await requireSeller();
  const descricaoLimpa = descricao.trim();
  if (!descricaoLimpa) return { ok: false, error: "Descreva o que aconteceu." };

  const drop = await createDropshippingAdminClient();
  const { error } = await drop.from("relatos_problema").insert({
    cliente_id: seller.id,
    titulo: titulo.trim() || "Problema reportado",
    descricao: descricaoLimpa,
    pagina: pagina || null,
  });
  if (error) return { ok: false, error: error.message };

  try {
    const sistema = await createSistemaAdminClient();
    const { data: gestores } = await sistema.from("profiles").select("id").in("role", ["admin", "gerente"]).eq("ativo", true);
    await criarNotificacoes(
      (gestores ?? []).map((g) => ({
        userId: g.id as string,
        tipo: "seller",
        titulo: `[${seller.nome}] Novo relato de problema`,
        descricao: descricaoLimpa,
        link: "/sistema/dropshipping/relatos",
      }))
    );
  } catch (e) {
    console.error("reportarProblema -> avisar gestores:", e);
  }

  return { ok: true };
}

/** Admin marca um relato como resolvido, com uma resposta opcional pro seller ver. */
export async function resolverRelatoProblema(id: string, respostaAdmin: string): Promise<ActionResult> {
  const profile = await getSistemaProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };
  if (!canManage(profile.role)) return { ok: false, error: "Apenas admin/gerente podem resolver relatos." };

  const drop = await createDropshippingAdminClient();
  const { error } = await drop
    .from("relatos_problema")
    .update({
      status: "resolvido",
      resposta_admin: respostaAdmin.trim() || null,
      resolvido_em: new Date().toISOString(),
      resolvido_por: profile.id,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sistema/dropshipping/relatos");
  return { ok: true };
}

/** Reabre um relato marcado como resolvido por engano. */
export async function reabrirRelatoProblema(id: string): Promise<ActionResult> {
  const profile = await getSistemaProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };
  if (!canManage(profile.role)) return { ok: false, error: "Apenas admin/gerente podem reabrir relatos." };

  const drop = await createDropshippingAdminClient();
  const { error } = await drop
    .from("relatos_problema")
    .update({ status: "aberto", resolvido_em: null, resolvido_por: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sistema/dropshipping/relatos");
  return { ok: true };
}
