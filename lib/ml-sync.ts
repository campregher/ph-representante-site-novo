import { createAdminClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";
import { getProductById } from "@/lib/produtos";

const ML_BASE = "https://api.mercadolibre.com";

export type NotifTipo = "produto_editado" | "produto_pausado" | "produto_excluido";

const MENSAGENS: Record<NotifTipo, string> = {
  produto_editado:
    "A marca atualizou as informações deste produto. Sincronize seu anúncio para manter os dados atualizados.",
  produto_pausado:
    "A marca pausou este produto no catálogo. Seu anúncio permanece ativo — você decide o que fazer.",
  produto_excluido:
    "A marca removeu este produto do catálogo. Considere pausar ou remover seu anúncio no ML.",
};

/** Cria notificações para todos os clientes que anunciaram este produto */
export async function notificarClientesML(
  produtoId: string,
  produtoName: string,
  tipo: NotifTipo
): Promise<number> {
  const db = await createAdminClient();

  const { data: anuncios } = await db
    .from("portal_ml_anuncios")
    .select("cliente_id, ml_item_id")
    .eq("produto_id", produtoId);

  if (!anuncios?.length) return 0;

  await db.from("portal_ml_notificacoes").insert(
    anuncios.map(a => ({
      cliente_id:   a.cliente_id,
      produto_id:   produtoId,
      produto_name: produtoName,
      ml_item_id:   a.ml_item_id,
      tipo,
      mensagem: MENSAGENS[tipo],
    }))
  );

  return anuncios.length;
}

/** Sincroniza título, descrição e imagens de um anúncio ML com os dados atuais do produto */
export async function sincronizarAnuncioML(
  clienteId: string,
  produtoId: string,
  mlItemId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const [token, product] = await Promise.all([
      getValidPortalToken(clienteId),
      getProductById(produtoId),
    ]);

    if (!product) return { ok: false, error: "Produto não encontrado" };

    const pictures = (product.images ?? [])
      .filter(Boolean)
      .map((url: string) => ({ source: url }));

    /* atualiza item */
    const itemRes = await fetch(`${ML_BASE}/items/${mlItemId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: product.name,
        ...(pictures.length > 0 && { pictures }),
      }),
    });

    if (!itemRes.ok) {
      const err = await itemRes.json();
      return { ok: false, error: err.message ?? "Erro ao atualizar anúncio no ML" };
    }

    /* atualiza descrição */
    if (product.description) {
      await fetch(`${ML_BASE}/items/${mlItemId}/description`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plain_text: product.description }),
      }).catch(() => {});
    }

    /* atualiza updated_at no nosso banco */
    const db = await createAdminClient();
    await db.from("portal_ml_anuncios")
      .update({ updated_at: new Date().toISOString() })
      .eq("cliente_id", clienteId)
      .eq("ml_item_id", mlItemId);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro interno" };
  }
}

/**
 * Atualiza automaticamente as fotos de todos os anúncios ML
 * dos clientes que publicaram este produto.
 * Executa em paralelo; falhas individuais são ignoradas silenciosamente.
 */
export async function autoSincronizarFotosML(
  produtoId: string,
  images: string[]
): Promise<{ total: number; ok: number }> {
  const db = await createAdminClient();

  const { data: anuncios } = await db
    .from("portal_ml_anuncios")
    .select("cliente_id, ml_item_id")
    .eq("produto_id", produtoId);

  if (!anuncios?.length) return { total: 0, ok: 0 };

  const pictures = images.filter(Boolean).map((url: string) => ({ source: url }));
  if (!pictures.length) return { total: anuncios.length, ok: 0 };

  const results = await Promise.allSettled(
    anuncios.map(async a => {
      try {
        const token = await getValidPortalToken(a.cliente_id);

        const res = await fetch(`${ML_BASE}/items/${a.ml_item_id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pictures }),
        });

        if (!res.ok) throw new Error(`ML ${res.status}`);

        await db.from("portal_ml_anuncios")
          .update({ updated_at: new Date().toISOString() })
          .eq("cliente_id", a.cliente_id)
          .eq("ml_item_id", a.ml_item_id);
      } catch {
        /* falha silenciosa por cliente */
      }
    })
  );

  const ok = results.filter(r => r.status === "fulfilled").length;
  return { total: anuncios.length, ok };
}

/** Pausa um anúncio ML sem remover do banco */
export async function pausarAnuncioML(
  clienteId: string,
  mlItemId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await getValidPortalToken(clienteId);

    const res = await fetch(`${ML_BASE}/items/${mlItemId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "paused" }),
    });

    if (!res.ok) {
      const err = await res.json();
      return { ok: false, error: err.message ?? "Erro ao pausar anúncio" };
    }

    const db = await createAdminClient();
    await db.from("portal_ml_anuncios")
      .update({ ml_status: "paused", updated_at: new Date().toISOString() })
      .eq("cliente_id", clienteId)
      .eq("ml_item_id", mlItemId);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro interno" };
  }
}
