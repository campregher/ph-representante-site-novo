import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sincronizarAnuncioML, pausarAnuncioML } from "@/lib/ml-sync";

export const runtime = "nodejs";

/** POST { acao: "sincronizar"|"pausar"|"remover", notificacao_id, ml_item_id, produto_id } */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { acao, notificacao_id, ml_item_id, produto_id } = await request.json() as {
    acao:           "sincronizar" | "pausar" | "remover" | "dispensar";
    notificacao_id: string;
    ml_item_id:     string;
    produto_id:     string;
  };

  if (!acao || !notificacao_id || !ml_item_id)
    return NextResponse.json({ error: "Parâmetros obrigatórios faltando" }, { status: 400 });

  const db = await createAdminClient();
  let acao_tomada = acao;
  let error: string | undefined;

  if (acao === "sincronizar") {
    const result = await sincronizarAnuncioML(user.id, produto_id, ml_item_id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });

  } else if (acao === "pausar") {
    const result = await pausarAnuncioML(user.id, ml_item_id);
    if (!result.ok) { error = result.error; acao_tomada = "pausado" as "pausar"; }
    else acao_tomada = "pausado" as "pausar";

  } else if (acao === "remover") {
    /* pausa no ML e remove do banco */
    await pausarAnuncioML(user.id, ml_item_id).catch(() => {});
    await db.from("portal_ml_anuncios")
      .delete()
      .eq("cliente_id", user.id)
      .eq("ml_item_id", ml_item_id);
    acao_tomada = "removido" as "remover";

  } else {
    /* dispensar — apenas marca como lida */
    acao_tomada = "dispensado" as "dispensar";
  }

  /* marca notificação como lida com a ação tomada */
  await db.from("portal_ml_notificacoes")
    .update({ lida: true, acao_tomada: acao_tomada as string })
    .eq("id", notificacao_id)
    .eq("cliente_id", user.id);

  if (error) return NextResponse.json({ ok: false, error }, { status: 422 });
  return NextResponse.json({ ok: true });
}
