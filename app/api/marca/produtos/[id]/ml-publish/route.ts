import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { getProductById } from "@/lib/produtos";
import { getValidToken } from "@/lib/ml-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

/* campos que injetamos automaticamente — não bloqueamos no publish */
const AUTO_INJECT = new Set(["BRAND", "PART_NUMBER"]);
/* campos que nunca enviamos */
const NEVER_SEND  = new Set(["HAS_COMPATIBILITIES", "EMPTY_GTIN_REASON"]);

interface MLRawAttr {
  id: string;
  name: string;
  value_type: string;
  tags?: Record<string, unknown>;
  values?: { id: string; name: string }[];
}

/* mapeia valor armazenado para formato de atributo ML */
function toMLAttr(
  attrId: string,
  rawValue: string,
  meta: MLRawAttr
): { id: string; value_name?: string; value_id?: string; value_unit?: string } | null {
  if (!rawValue?.trim()) return null;

  if (meta.value_type === "number_unit") {
    const [num, unit] = rawValue.split("||");
    if (!num) return null;
    return { id: attrId, value_name: num, value_unit: unit ?? "" };
  }

  if (meta.value_type === "list" && meta.values?.length) {
    const match = meta.values.find(v => v.id === rawValue || v.name === rawValue);
    return match
      ? { id: attrId, value_id: match.id }
      : { id: attrId, value_name: rawValue };
  }

  return { id: attrId, value_name: rawValue };
}

/* mensagens amigáveis para error codes do ML */
const ERROR_LABELS: Record<string, string> = {
  "shipping.lost_me1_by_user":          "Configure o envio ME2 na sua conta do Mercado Livre",
  "item.shipping.mandatory_free_shipping": "Frete grátis é obrigatório para anúncios Premium (gold_special)",
  "item.attribute.missing_catalog_required": "Atributos de catálogo obrigatórios faltando",
  "item.attributes.missing_required":    "Atributos obrigatórios da categoria não preenchidos",
  "item.title.invalid_characters":       "O título contém caracteres inválidos",
  "item.title.too_short":                "Título muito curto (mínimo 10 caracteres)",
  "item.title.too_long":                 "Título muito longo (máximo 60 caracteres)",
  "item.price.not_positive":             "Preço deve ser maior que zero",
  "item.pictures.url_unreachable":       "URL de imagem inacessível ou inválida",
};

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const db = await createAdminClient();

  /* ── busca produto ── */
  const product = await getProductById(id);
  if (!product)                        return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  if (product.brand !== ctx.marcaSlug) return NextResponse.json({ error: "Sem permissão" },         { status: 403 });
  if (!product.ml_category_id)         return NextResponse.json({ error: "Produto sem categoria ML vinculada" }, { status: 400 });
  const listingPrice = product.resale_price ?? product.price;
  if (!listingPrice || listingPrice <= 0)
    return NextResponse.json({ error: "Produto sem preço de revenda. Preencha o preço de revenda antes de publicar." }, { status: 400 });

  /* ── token ML ── */
  let token: string;
  try {
    token = await getValidToken(ctx.marcaSlug);
  } catch {
    return NextResponse.json({ error: "Marca não conectada ao Mercado Livre. Vá em Perfil → Mercado Livre e conecte." }, { status: 400 });
  }

  /* ── busca nome da marca para BRAND ── */
  const { data: marcaRow } = await db
    .from("marcas")
    .select("name")
    .eq("slug", ctx.marcaSlug)
    .single();
  const marcaNome = marcaRow?.name ?? ctx.marcaSlug;

  /* ── atributos ML da categoria ── */
  let mlAttrs: MLRawAttr[] = [];
  try {
    const attrRes = await fetch(`${ML_BASE}/categories/${product.ml_category_id}/attributes`);
    if (attrRes.ok) mlAttrs = await attrRes.json();
  } catch { /* continua sem metadata */ }

  /* ── validação prévia: atributos obrigatórios visíveis que não foram preenchidos ── */
  const storedAttrs = product.attributes ?? {};
  const missingRequired: string[] = [];

  for (const attr of mlAttrs) {
    if (!attr.tags?.required) continue;
    if (attr.tags?.hidden || attr.tags?.read_only) continue;
    if (AUTO_INJECT.has(attr.id)) continue;  /* injetamos automaticamente */
    if (!storedAttrs[attr.id]?.trim()) {
      missingRequired.push(attr.name);
    }
  }

  if (missingRequired.length > 0) {
    return NextResponse.json({
      error: `Preencha os seguintes campos obrigatórios antes de publicar: ${missingRequired.join(", ")}`,
      missing: missingRequired,
    }, { status: 422 });
  }

  /* ── monta atributos ── */
  const mlAttributes: { id: string; value_name?: string; value_id?: string; value_unit?: string }[] = [];

  /* injeta BRAND e PART_NUMBER automaticamente */
  mlAttributes.push({ id: "BRAND",       value_name: marcaNome });
  mlAttributes.push({ id: "PART_NUMBER", value_name: product.sku });

  /* mapeia os demais atributos do produto */
  for (const [attrId, rawValue] of Object.entries(storedAttrs)) {
    if (NEVER_SEND.has(attrId))  continue;
    if (AUTO_INJECT.has(attrId)) continue;

    const meta = mlAttrs.find(a => a.id === attrId);
    if (!meta) {
      /* atributo desconhecido: envia como value_name se tiver valor */
      if (rawValue?.trim()) mlAttributes.push({ id: attrId, value_name: rawValue.trim() });
      continue;
    }

    const mapped = toMLAttr(attrId, rawValue, meta);
    if (mapped) mlAttributes.push(mapped);
  }

  /* ── payload do anúncio ── */
  const itemBody: Record<string, unknown> = {
    title:              product.name,
    category_id:        product.ml_category_id,
    price:              listingPrice,
    currency_id:        "BRL",
    available_quantity: 1,
    buying_mode:        "buy_it_now",
    condition:          "new",
    listing_type_id:    "gold_pro",   /* Clássico — não exige frete grátis obrigatório */
    shipping: {
      mode:          "me2",
      free_shipping: false,
      local_pick_up: false,
    },
    pictures: (product.images ?? [])
      .filter(Boolean)
      .map(url => ({ source: url })),
    attributes: mlAttributes,
  };

  console.log("[ml-publish] payload:", JSON.stringify(itemBody, null, 2));

  /* ── cria item no ML ── */
  const itemRes = await fetch(`${ML_BASE}/items`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(itemBody),
  });

  const itemData = await itemRes.json();

  if (!itemRes.ok) {
    console.log("[ml-publish] ML error:", JSON.stringify(itemData, null, 2));

    await db.from("produtos").update({ ml_status: "error", ml_error: itemData }).eq("id", id);

    /* constrói mensagem amigável a partir dos causes do ML */
    if (Array.isArray(itemData.cause) && itemData.cause.length > 0) {
      const lines = itemData.cause.map((c: { code?: string; description?: string }) => {
        const label = ERROR_LABELS[c.code ?? ""] ?? c.code ?? "";
        const desc  = c.description?.trim();
        return desc ? `• ${label || desc}${label && desc ? ` (${desc})` : ""}` : `• ${label}`;
      });
      return NextResponse.json({
        error:   lines.join("\n"),
        details: itemData,
      }, { status: 422 });
    }

    return NextResponse.json({
      error:   itemData.message ?? itemData.error ?? "ML rejeitou o anúncio",
      details: itemData,
    }, { status: 422 });
  }

  const mlItemId = itemData.id as string;

  /* ── posta descrição separado (ML não aceita no payload principal) ── */
  if (product.description?.trim()) {
    const descRes = await fetch(`${ML_BASE}/items/${mlItemId}/description`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body:    JSON.stringify({ plain_text: product.description }),
    });
    if (!descRes.ok) {
      console.warn("[ml-publish] description failed:", await descRes.text());
    }
  }

  const permalink = itemData.permalink as string | undefined;

  /* ── salva no banco ── */
  await db.from("produtos").update({
    ml_item_id:      mlItemId,
    ml_status:       itemData.status ?? "active",
    ml_error:        null,
    ml_published_at: new Date().toISOString(),
  }).eq("id", id);

  return NextResponse.json({
    ok:         true,
    ml_item_id: mlItemId,
    ml_status:  itemData.status,
    ml_url:     permalink ?? `https://produto.mercadolivre.com.br/${mlItemId}`,
  });
}
