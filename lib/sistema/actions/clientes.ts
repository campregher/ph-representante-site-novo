"use server";

import { revalidatePath } from "next/cache";
import { createSistemaClient } from "@/lib/supabase/server";
import { getSistemaProfile, canManage } from "@/lib/sistema/auth";
import {
  clienteSchema,
  clienteContatoSchema,
  clienteRepresentadaSchema,
} from "@/lib/sistema/schemas";
import { onlyDigits } from "@/lib/sistema/format";
import type { ActionResult } from "@/lib/sistema/types";

async function guard() {
  const profile = await getSistemaProfile();
  if (!profile) return { profile: null, error: "Sessão expirada." as const };
  if (profile.role === "consulta")
    return { profile: null, error: "Seu papel é somente leitura." as const };
  return { profile, error: null };
}

function friendly(e: { code?: string; message: string }): string {
  if (e.code === "23505") {
    if (e.message.includes("cnpj")) return "Já existe um cliente com este CNPJ.";
    if (e.message.includes("cpf")) return "Já existe um cliente com este CPF.";
    return "Registro duplicado.";
  }
  if (e.code === "42501" || /row-level security/i.test(e.message))
    return "Sem permissão para este cliente.";
  return e.message;
}

export async function saveCliente(id: string | null, raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };

  const parsed = clienteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;
  const supabase = await createSistemaClient();

  const payload: Record<string, unknown> = {
    ...v,
    cnpj: v.cnpj ? onlyDigits(v.cnpj) : null,
    cpf: v.cpf ? onlyDigits(v.cpf) : null,
    updated_by: g.profile!.id,
  };
  // vendedor só cadastra cliente pra si
  if (g.profile!.role === "vendedor") payload.vendedor_id = g.profile!.id;

  if (id) {
    const { error } = await supabase.from("clientes").update(payload).eq("id", id);
    if (error) return { ok: false, error: friendly(error) };
    revalidatePath("/sistema/clientes");
    revalidatePath(`/sistema/clientes/${id}`);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({ ...payload, created_by: g.profile!.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath("/sistema/clientes");
  return { ok: true, id: data.id as string };
}

export async function deleteCliente(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  if (!canManage(g.profile!.role))
    return { ok: false, error: "Apenas gerente/admin podem excluir clientes." };
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) {
    if (error.code === "23503")
      return { ok: false, error: "Há pedidos vinculados. Bloqueie ou inative o cliente." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/sistema/clientes");
  return { ok: true };
}

// ───────────────────────────── Contatos ─────────────────────────────

export async function saveContato(id: string | null, raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const parsed = clienteContatoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createSistemaClient();

  if (parsed.data.principal) {
    // garante um único principal
    await supabase
      .from("cliente_contatos")
      .update({ principal: false })
      .eq("cliente_id", parsed.data.cliente_id);
  }

  if (id) {
    const { error } = await supabase.from("cliente_contatos").update(parsed.data).eq("id", id);
    if (error) return { ok: false, error: friendly(error) };
  } else {
    const { error } = await supabase.from("cliente_contatos").insert(parsed.data);
    if (error) return { ok: false, error: friendly(error) };
  }
  revalidatePath(`/sistema/clientes/${parsed.data.cliente_id}`);
  return { ok: true };
}

export async function deleteContato(id: string, clienteId: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("cliente_contatos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/sistema/clientes/${clienteId}`);
  return { ok: true };
}

// ─────────────────────── Vínculo cliente × representada ───────────────────────

export async function saveVinculo(id: string | null, raw: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const parsed = clienteRepresentadaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createSistemaClient();

  if (parsed.data.tabela_preco_id) {
    const { data: tab } = await supabase
      .from("tabelas_preco")
      .select("representada_id")
      .eq("id", parsed.data.tabela_preco_id)
      .maybeSingle();
    if (tab && tab.representada_id !== parsed.data.representada_id)
      return { ok: false, error: "A tabela de preço não pertence a esta representada." };
  }

  if (id) {
    const { error } = await supabase.from("cliente_representada").update(parsed.data).eq("id", id);
    if (error) return { ok: false, error: friendly(error) };
  } else {
    const { error } = await supabase.from("cliente_representada").insert(parsed.data);
    if (error) {
      if (error.code === "23505")
        return { ok: false, error: "Este cliente já tem vínculo com essa representada." };
      return { ok: false, error: friendly(error) };
    }
  }
  revalidatePath(`/sistema/clientes/${parsed.data.cliente_id}`);
  return { ok: true };
}

export async function deleteVinculo(id: string, clienteId: string): Promise<ActionResult> {
  const g = await guard();
  if (g.error) return { ok: false, error: g.error };
  const supabase = await createSistemaClient();
  const { error } = await supabase.from("cliente_representada").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/sistema/clientes/${clienteId}`);
  return { ok: true };
}
