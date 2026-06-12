import { createAdminClient } from "@/lib/supabase/server";

export type TipoNotificacao =
  | "novo_pedido"
  | "pedido_aprovado"
  | "pedido_enviado"
  | "pedido_pago"
  | "pedido_recusado"
  | "acesso_solicitado"
  | "acesso_aprovado"
  | "acesso_recusado"
  | "mensagem_marca"
  | "mensagem_portal";

interface NotificacaoParams {
  destinatarioTipo: "marca" | "portal";
  destinatarioId: string; // auth.uid() do usuário
  tipo: TipoNotificacao;
  titulo: string;
  mensagem?: string;
  link?: string;
}

export async function criarNotificacao(params: NotificacaoParams): Promise<void> {
  try {
    const db = await createAdminClient();
    await db.from("notificacoes").insert({
      destinatario_tipo: params.destinatarioTipo,
      destinatario_id:   params.destinatarioId,
      tipo:              params.tipo,
      titulo:            params.titulo,
      mensagem:          params.mensagem ?? null,
      link:              params.link ?? null,
    });
  } catch {
    // notificação nunca bloqueia o fluxo principal
  }
}

/** Busca o auth user_id de um usuário de marca pelo slug */
export async function getMarcaUserId(marcaSlug: string): Promise<string | null> {
  try {
    const db = await createAdminClient();
    const { data } = await db
      .from("marca_users")
      .select("user_id")
      .eq("marca_slug", marcaSlug)
      .limit(1)
      .single();
    return data?.user_id ?? null;
  } catch {
    return null;
  }
}

/** Busca o auth user_id de um cliente pelo cliente_id (UUID da tabela clientes) */
export async function getClienteUserId(clienteId: string): Promise<string | null> {
  try {
    const db = await createAdminClient();
    const { data } = await db
      .from("clientes")
      .select("user_id")
      .eq("id", clienteId)
      .single();
    return data?.user_id ?? null;
  } catch {
    return null;
  }
}
