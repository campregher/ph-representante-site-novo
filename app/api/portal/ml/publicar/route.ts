import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

const BLOCKLIST = new Set(["BRAND", "PART_NUMBER", "HAS_COMPATIBILITIES", "EMPTY_GTIN_REASON"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { produto_id, preco_revenda } = await request.json() as {
    produto_id: string;
    preco_revenda: number;
  };

  if (!produto_id)      return NextResponse.json({ error: "produto_id obrigatório" }, { status: 400 });
  if (!preco_revenda || preco_revenda <= 0)
    return NextResponse.json({ error: "Preço de revenda inválido" }, { status: 400 });

  const db    = await createAdminClient();
  const token = await getValidPortalToken(user.id).catch(() => null);
  if (!token) return NextResponse.json({ error: "Conecte sua conta do Mercado Livre primeiro" }, { status: 403 });

  /* busca produto */
  const { data: product, error: prodErr } = await db
    .from("produtos")
    .select("*")
    .eq("id", produto_id)
    .single();

  if (prodErr || !product)
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  if (!product.ml_category_id)
    return NextResponse.json({ error: "Produto sem categoria do Mercado Livre" }, { status: 400 });

  /* busca atributos da categoria */
  let attrPayload: { id: string; value_name?: string; value_id?: string; unit?: string }[] = [];
  try {
    const attrRes = await fetch(`${ML_BASE}/categories/${product.ml_category_id}/attributes`);
    if (attrRes.ok) {
      const allAttrs: { id: string; value_type: string; tags?: Record<string, unknown>; values?: { id: string; name: string }[] }[] = await attrRes.json();
      const productAttrs: Record<string, string> = product.attributes ?? {};

      for (const attr of allAttrs) {
        if (BLOCKLIST.has(attr.id)) continue;
        if (attr.tags?.hidden || attr.tags?.read_only) continue;
        const val = productAttrs[attr.id];
        if (!val) continue;

        if (attr.value_type === "list") {
          const match = (attr.values ?? []).find(v => v.name === val || v.id === val);
          if (match) attrPayload.push({ id: attr.id, value_id: match.id, value_name: match.name });
        } else if (attr.value_type === "number_unit") {
          const [num, unit] = val.split("||");
          attrPayload.push({ id: attr.id, value_name: num.trim(), unit: unit?.trim() });
        } else {
          attrPayload.push({ id: attr.id, value_name: val });
        }
      }
    }
  } catch { /* usa atributos vazios se ML falhar */ }

  /* monta payload do anúncio */
  const pictures = (product.images ?? [])
    .filter(Boolean)
    .map((url: string) => ({ source: url }));

  const body = {
    title:              product.name,
    category_id:        product.ml_category_id,
    price:              preco_revenda,
    currency_id:        "BRL",
    available_quantity: 1,
    buying_mode:        "buy_it_now",
    condition:          product.condition ?? "new",
    listing_type_id:    "gold_pro",
    shipping: { mode: "me2", free_shipping: false },
    pictures,
    attributes: [
      { id: "BRAND",       value_name: product.brand },
      { id: "PART_NUMBER", value_name: product.sku  },
      ...attrPayload,
    ],
  };

  const mlRes = await fetch(`${ML_BASE}/items`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const mlData = await mlRes.json();
  if (!mlRes.ok) {
    const msg = mlData.message ?? mlData.error ?? "Erro ao publicar no Mercado Livre";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  /* publica descrição */
  if (product.description) {
    await fetch(`${ML_BASE}/items/${mlData.id}/description`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ plain_text: product.description }),
    }).catch(() => {});
  }

  /* salva anúncio */
  await db.from("portal_ml_anuncios").upsert({
    cliente_id:   user.id,
    produto_id:   produto_id,
    marca_slug:   product.brand,
    ml_item_id:   mlData.id,
    ml_status:    mlData.status ?? "active",
    preco_revenda,
    updated_at:   new Date().toISOString(),
  }, { onConflict: "ml_item_id" });

  return NextResponse.json({
    ok:         true,
    ml_item_id: mlData.id,
    ml_url:     mlData.permalink,
  });
}

/* Remove anúncio */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { ml_item_id } = await request.json() as { ml_item_id: string };
  if (!ml_item_id) return NextResponse.json({ error: "ml_item_id obrigatório" }, { status: 400 });

  const db    = await createAdminClient();
  const token = await getValidPortalToken(user.id).catch(() => null);

  /* pausa anúncio no ML */
  if (token) {
    await fetch(`${ML_BASE}/items/${ml_item_id}`, {
      method:  "PUT",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "paused" }),
    }).catch(() => {});
  }

  await db.from("portal_ml_anuncios")
    .delete()
    .eq("ml_item_id", ml_item_id)
    .eq("cliente_id", user.id);

  return NextResponse.json({ ok: true });
}
