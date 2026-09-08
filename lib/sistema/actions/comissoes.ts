"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient, createSistemaAdminClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { canFinance } from "@/lib/sistema/roles";
import { sincronizarComissaoPedido } from "@/lib/sistema/comissoes-sync";
import { STATUS_VENDA } from "@/lib/sistema/types";
import type { ActionResult } from "@/lib/sistema/types";

const VENDA = [...STATUS_VENDA] as string[];

async function guardFinance() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (profile.role !== "admin" && profile.role !== "financeiro")
    return { profile: null, error: "Apenas Financeiro/Admin podem alterar comissões." as const };
  return { profile, error: null };
}

export async function marcarComissao(
  id: string,
  status: "a_receber" | "recebida" | "divergencia",
  extra?: { data_recebimento?: string | null; observacoes?: string | null }
): Promise<ActionResult> {
  const g = await guardFinance();
  if (g.error) return { ok: false, error: g.error };

  const patch: Record<string, unknown> = { status };
  if (status === "recebida") {
    patch.data_recebimento =
      extra?.data_recebimento || new Date().toISOString().slice(0, 10);
  } else if (status === "a_receber") {
    patch.data_recebimento = null;
  }
  if (extra && "observacoes" in extra) patch.observacoes = extra.observacoes || null;

  const supabase = await createSistemaClient();
  const { error } = await supabase.from("comissoes").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sistema/comissoes");
  return { ok: true };
}

export async function atualizarComissao(
  id: string,
  patch: { percentual?: number; data_prevista?: string | null; observacoes?: string | null }
): Promise<ActionResult> {
  const g = await guardFinance();
  if (g.error) return { ok: false, error: g.error };

  const supabase = await createSistemaClient();

  const dados: Record<string, unknown> = {};
  if (patch.percentual != null && Number.isFinite(patch.percentual)) {
    const { data: row } = await supabase
      .from("comissoes")
      .select("valor_base")
      .eq("id", id)
      .maybeSingle();
    const base = Number(row?.valor_base ?? 0);
    dados.percentual = patch.percentual;
    dados.valor_comissao = Math.round(base * patch.percentual) / 100;
  }
  if ("data_prevista" in patch) dados.data_prevista = patch.data_prevista || null;
  if ("observacoes" in patch) dados.observacoes = patch.observacoes || null;

  if (Object.keys(dados).length === 0) return { ok: true };

  const { error } = await supabase.from("comissoes").update(dados).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sistema/comissoes");
  return { ok: true };
}

/** (Re)gera comissões para todos os pedidos em status de venda. Bootstrap / conserto. */
export async function sincronizarTodasComissoes(): Promise<ActionResult<{ total?: number }>> {
  const profile = await getSistemaProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };
  if (!canFinance(profile.role))
    return { ok: false, error: "Sem permissão para sincronizar comissões." };

  const db = await createSistemaAdminClient();
  const { data: peds, error } = await db
    .from("pedidos")
    .select("id")
    .in("status", VENDA);
  if (error) return { ok: false, error: error.message };

  for (const p of peds ?? []) {
    await sincronizarComissaoPedido(p.id as string);
  }

  revalidatePath("/sistema/comissoes");
  return { ok: true, total: (peds ?? []).length };
}
