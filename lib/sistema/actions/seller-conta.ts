"use server";

import { revalidatePath } from "next/cache";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/sistema/seller-auth";
import type { ActionResult } from "@/lib/sistema/types";

export interface MeuCadastroInput {
  razao_social: string;
  nome_fantasia: string;
  telefone: string;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

/**
 * Seller edita os próprios dados de contato/endereço (não CNPJ/CPF/e-mail —
 * documento e login não mudam por aqui). Sempre resolve o cliente pela sessão
 * autenticada (requireSeller), nunca por um id vindo do client.
 */
export async function atualizarMeuCadastro(raw: MeuCadastroInput): Promise<ActionResult> {
  const seller = await requireSeller();
  const db = await createSistemaAdminClient();
  const { error } = await db
    .from("clientes")
    .update({
      razao_social: raw.razao_social || null,
      nome_fantasia: raw.nome_fantasia || null,
      telefone: raw.telefone || null,
      whatsapp: raw.whatsapp || null,
      cep: raw.cep || null,
      logradouro: raw.logradouro || null,
      numero: raw.numero || null,
      complemento: raw.complemento || null,
      bairro: raw.bairro || null,
      cidade: raw.cidade || null,
      estado: raw.estado || null,
    })
    .eq("id", seller.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/drop/dashboard/cadastro");
  revalidatePath("/drop/dashboard");
  return { ok: true };
}
