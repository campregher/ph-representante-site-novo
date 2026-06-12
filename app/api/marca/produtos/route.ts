import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { getProducts, createProduct } from "@/lib/produtos";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q               = searchParams.get("q")              ?? undefined;
  const ml_category_id  = searchParams.get("ml_category_id") ?? undefined;

  try {
    const products = await getProducts({ brand: ctx.marcaSlug, q, ml_category_id, activeOnly: false });
    return NextResponse.json(products);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const { sku, name, description, price, resale_price, images, active, ml_category_id, ml_category_name, ml_category_path, attributes, compatibilidades } = body;
  if (!name?.trim())          return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  if (!sku?.trim())           return NextResponse.json({ error: "SKU obrigatório" }, { status: 400 });
  if (resale_price == null || Number(resale_price) <= 0)
    return NextResponse.json({ error: "Preço de revenda obrigatório" }, { status: 400 });

  const product = await createProduct({
    sku:               sku.trim(),
    name:              name.trim(),
    brand:             ctx.marcaSlug,
    description:       description?.trim() ?? "",
    price:             price        != null ? Number(price)        : undefined,
    resale_price:      Number(resale_price),
    images:            Array.isArray(images) ? images.filter(Boolean) : [],
    active:            active !== false,
    ml_category_id:    ml_category_id ?? undefined,
    ml_category_name:  ml_category_name ?? undefined,
    ml_category_path:  ml_category_path ?? undefined,
    attributes:        attributes ?? {},
    compatibilidades:  Array.isArray(compatibilidades) ? compatibilidades : [],
  });

  return NextResponse.json(product, { status: 201 });
}
