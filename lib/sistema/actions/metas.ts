"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { metaGeralSchema, metaVendedorSchema } from "@/lib/sistema/schemas";
import type { ActionResult } from "@/lib/sistema/types";

/**
 * Meta mensal GERAL (sem vendedor/representada). Metas por vendedor/representada
 * ficam para a Fase 3.
 */
export async function saveMetaGeral(raw: unknown): Promise<ActionResult> {
  const profile = await getSistemaProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };
  if (!canManage(profile.role))
    return { ok: false, error: "Apenas administradores e gerentes podem definir metas." };

  const parsed = metaGeralSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { ano, mes, valor_meta } = parsed.data;
  const supabase = await createSistemaClient();

  const { data: existente } = await supabase
    .from("metas_vendas")
    .select("id")
    .eq("ano", ano)
    .eq("mes", mes)
    .is("vendedor_id", null)
    .is("representada_id", null)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("metas_vendas")
      .update({ valor_meta })
      .eq("id", (existente as { id: string }).id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("metas_vendas").insert({
      ano,
      mes,
      valor_meta,
      vendedor_id: null,
      representada_id: null,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/sistema/configuracoes");
  revalidatePath("/sistema");
  return { ok: true };
}

/** Meta mensal de um vendedor (opcionalmente por representada). */
export async function saveMetaVendedor(raw: unknown): Promise<ActionResult> {
  const profile = await getSistemaProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };
  if (!canManage(profile.role))
    return { ok: false, error: "Apenas administradores e gerentes podem definir metas." };

  const parsed = metaVendedorSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { ano, mes, vendedor_id, representada_id, valor_meta } = parsed.data;
  const repId = representada_id || null;
  const supabase = await createSistemaClient();

  let sel = supabase
    .from("metas_vendas")
    .select("id")
    .eq("ano", ano)
    .eq("mes", mes)
    .eq("vendedor_id", vendedor_id);
  sel = repId ? sel.eq("representada_id", repId) : sel.is("representada_id", null);
  const { data: existente } = await sel.maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("metas_vendas")
      .update({ valor_meta })
      .eq("id", (existente as { id: string }).id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("metas_vendas").insert({
      ano,
      mes,
      vendedor_id,
      representada_id: repId,
      valor_meta,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/sistema/configuracoes");
  revalidatePath("/sistema");
  return { ok: true };
}
