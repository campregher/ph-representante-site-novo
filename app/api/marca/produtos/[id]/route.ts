import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { getProductById, updateProduct, deleteProduct } from "@/lib/produtos";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  if (product.brand !== ctx.marcaSlug) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await request.json();
  const { sku, name, description, price, images, active } = body;

  const updated = await updateProduct(id, {
    ...(sku         != null && { sku }),
    ...(name        != null && { name }),
    ...(description != null && { description }),
    ...(price       != null && { price: Number(price) }),
    ...(images      != null && { images: Array.isArray(images) ? images.filter(Boolean) : [] }),
    ...(active      != null && { active: Boolean(active) }),
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  if (product.brand !== ctx.marcaSlug) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await deleteProduct(id);
  return NextResponse.json({ ok: true });
}
