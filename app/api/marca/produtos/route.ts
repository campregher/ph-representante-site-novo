import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { getProducts, createProduct } from "@/lib/produtos";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;

  try {
    const products = await getProducts({ brand: ctx.marcaSlug, q, activeOnly: false });
    return NextResponse.json(products);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const { sku, name, description, price, images, active } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  if (!sku?.trim())  return NextResponse.json({ error: "SKU obrigatório" }, { status: 400 });

  const product = await createProduct({
    sku:         sku.trim(),
    name:        name.trim(),
    brand:       ctx.marcaSlug,
    description: description?.trim() ?? "",
    price:       price != null ? Number(price) : undefined,
    images:      Array.isArray(images) ? images.filter(Boolean) : [],
    active:      active !== false,
  });

  return NextResponse.json(product, { status: 201 });
}
