"use server";

import { createSistemaAdminClient } from "@/lib/supabase/server";
import { sellerCadastroSchema } from "@/lib/sistema/schemas";
import { onlyDigits } from "@/lib/sistema/format";
import type { ActionResult } from "@/lib/sistema/types";

/**
 * Auto-cadastro público de seller (sem login — /drop/cadastro). Usa o client
 * admin (service role) porque não há sessão. Cria o cliente com
 * is_seller=true, status='prospect' (fica pendente de aprovação — alguém do
 * time muda pra "ativo" pelo /sistema depois de conferir).
 *
 * Se já existe um cliente com o mesmo CNPJ/CPF: se já era seller, só avisa;
 * senão, marca is_seller=true nele e preenche os campos vazios (não sobrescreve
 * dado já cadastrado).
 */
export async function cadastrarSeller(
  raw: unknown
): Promise<ActionResult<{ jaExistia?: boolean }>> {
  const parsed = sellerCadastroSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;
  const cnpj = v.cnpj ? onlyDigits(v.cnpj) : null;
  const cpf = v.cpf ? onlyDigits(v.cpf) : null;
  if (cnpj && cnpj.length !== 14) return { ok: false, error: "CNPJ inválido — precisa ter 14 dígitos." };
  if (cpf && cpf.length !== 11) return { ok: false, error: "CPF inválido — precisa ter 11 dígitos." };

  const db = await createSistemaAdminClient();

  const { data: existente } = await db
    .from("clientes")
    .select("id, is_seller, telefone, whatsapp, email, cep, logradouro, numero, complemento, bairro, cidade, estado")
    .eq(cnpj ? "cnpj" : "cpf", cnpj ?? cpf)
    .maybeSingle();

  if (existente) {
    if (existente.is_seller) return { ok: true, jaExistia: true };
    const preencheSeVazio: Record<string, unknown> = { is_seller: true };
    const camposOpcionais = [
      ["telefone", v.telefone],
      ["whatsapp", v.whatsapp],
      ["email", v.email],
      ["cep", v.cep],
      ["logradouro", v.logradouro],
      ["numero", v.numero],
      ["complemento", v.complemento],
      ["bairro", v.bairro],
      ["cidade", v.cidade],
      ["estado", v.estado],
    ] as const;
    for (const [campo, valor] of camposOpcionais) {
      if (valor && !existente[campo as keyof typeof existente]) preencheSeVazio[campo] = valor;
    }
    const { error } = await db.from("clientes").update(preencheSeVazio).eq("id", existente.id as string);
    if (error) return { ok: false, error: error.message };
    return { ok: true, jaExistia: true };
  }

  const { error } = await db.from("clientes").insert({
    tipo_pessoa: v.tipo_pessoa,
    cnpj,
    cpf,
    razao_social: v.razao_social,
    nome_fantasia: v.nome_fantasia,
    inscricao_estadual: v.inscricao_estadual,
    telefone: v.telefone,
    whatsapp: v.whatsapp || v.telefone,
    email: v.email,
    cep: v.cep,
    logradouro: v.logradouro,
    numero: v.numero,
    complemento: v.complemento,
    bairro: v.bairro,
    cidade: v.cidade,
    estado: v.estado,
    status: "prospect",
    is_seller: true,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe um cadastro com este documento." };
    return { ok: false, error: error.message };
  }
  return { ok: true, jaExistia: false };
}
