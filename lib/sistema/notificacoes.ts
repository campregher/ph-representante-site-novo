import { createSistemaClient, createSistemaAdminClient } from "@/lib/supabase/server";

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

export interface NovaNotificacao {
  userId: string;
  tipo?: string;
  titulo: string;
  descricao?: string | null;
  link?: string | null;
}

/** Cria avisos in-app. Usa service role (cross-user, ignora RLS). Nunca lança. */
export async function criarNotificacoes(itens: NovaNotificacao[]): Promise<void> {
  const rows = itens
    .filter((n) => n.userId && n.titulo)
    .map((n) => ({
      user_id: n.userId,
      tipo: n.tipo ?? "info",
      titulo: n.titulo,
      descricao: n.descricao ?? null,
      link: n.link ?? null,
    }));
  if (!rows.length) return;
  try {
    const db = await createSistemaAdminClient();
    await db.from("notificacoes").insert(rows);
  } catch (e) {
    console.error("criarNotificacoes:", e);
  }
}

export async function criarNotificacao(n: NovaNotificacao): Promise<void> {
  return criarNotificacoes([n]);
}

/** Notificações do usuário logado (RLS). */
export async function getMinhasNotificacoes(
  limit = 20
): Promise<{ itens: Notificacao[]; naoLidas: number }> {
  const supabase = await createSistemaClient();
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("notificacoes")
      .select("id, tipo, titulo, descricao, link, lida, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("lida", false),
  ]);
  return { itens: (data as Notificacao[]) ?? [], naoLidas: count ?? 0 };
}
