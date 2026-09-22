import { cache } from "react";
import { redirect } from "next/navigation";
import { createSistemaClient, createSistemaAdminClient } from "@/lib/supabase/server";

export type AuthedSellerResult =
  | { kind: "sem_sessao" }
  | { kind: "sem_cadastro" }
  | { kind: "ok"; seller: SellerProfile };

export interface SellerProfile {
  id: string;
  portalToken: string;
  nome: string;
  email: string | null;
  status: "prospect" | "ativo" | "inativo" | "bloqueado" | "reativacao";
  emailConfirmado: boolean;
  /** true só quando o seller pode de fato usar o portal (e-mail confirmado + não bloqueado/prospect) */
  liberado: boolean;
}

const SELLER_COLS = "id, portal_token, nome_fantasia, razao_social, email, status, email_confirmado";

/**
 * Seller autenticado (via cookie do Supabase Auth) + dados de `comercial.clientes`.
 * Distingue "sem sessão" de "sessão válida mas sem cadastro de seller" — os dois
 * casos pedem redirecionamentos diferentes (login vs. erro), senão dá loop.
 */
export const getAuthedSellerResult = cache(async (): Promise<AuthedSellerResult> => {
  const session = await createSistemaClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { kind: "sem_sessao" };

  const db = await createSistemaAdminClient();
  const { data } = await db
    .from("clientes")
    .select(SELLER_COLS)
    .eq("auth_user_id", user.id)
    .eq("is_seller", true)
    .maybeSingle();
  if (!data) return { kind: "sem_cadastro" };

  const status = data.status as SellerProfile["status"];
  return {
    kind: "ok",
    seller: {
      id: data.id as string,
      portalToken: data.portal_token as string,
      nome: (data.nome_fantasia as string) || (data.razao_social as string) || "seller",
      email: data.email as string | null,
      status,
      emailConfirmado: !!data.email_confirmado,
      liberado: status !== "prospect" && status !== "bloqueado" && !!data.email_confirmado,
    },
  };
});

export async function getAuthedSeller(): Promise<SellerProfile | null> {
  const res = await getAuthedSellerResult();
  return res.kind === "ok" ? res.seller : null;
}

/** Exige login de seller. Redireciona pro /drop/login (sem sessão) ou /drop/erro (sem cadastro). */
export async function requireSeller(): Promise<SellerProfile> {
  const res = await getAuthedSellerResult();
  if (res.kind === "sem_sessao") redirect("/drop/login");
  if (res.kind === "sem_cadastro") redirect("/drop/erro?e=sem_cadastro");
  return res.seller;
}
