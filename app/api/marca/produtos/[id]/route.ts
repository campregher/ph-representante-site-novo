import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { getProductById, updateProduct, deleteProduct } from "@/lib/produtos";
import { notificarClientesML } from "@/lib/ml-sync";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  if (product.brand !== ctx.marcaSlug) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  return NextResponse.json(product);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  if (product.brand !== ctx.marcaSlug) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await request.json();
  const {
    sku, name, description, price, resale_price, images, active,
    ml_category_id, ml_category_name, ml_category_path, attributes, compatibilidades,
  } = body;

  if (resale_price !== undefined && (resale_price == null || Number(resale_price) <= 0))
    return NextResponse.json({ error: "Preço de revenda obrigatório" }, { status: 400 });

  const updated = await updateProduct(id, {
    ...(sku              != null && { sku }),
    ...(name             != null && { name }),
    ...(description      != null && { description }),
    ...(price            != null && { price: Number(price) }),
    ...(resale_price     != null && { resale_price: Number(resale_price) }),
    ...(images           != null && { images: Array.isArray(images) ? images.filter(Boolean) : [] }),
    ...(active           != null && { active: Boolean(active) }),
    ...(ml_category_id   != null && { ml_category_id }),
    ...(ml_category_name != null && { ml_category_name }),
    ...(ml_category_path != null && { ml_category_path }),
    ...(attributes       != null && { attributes }),
    ...(compatibilidades != null && { compatibilidades }),
  });

  /* notifica clientes que têm este produto anunciado no ML */
  let notificados = 0;
  const becamePaused = product.active && body.active === false;
  const contentChanged =
    body.name != null || body.description != null ||
    body.images != null || body.price != null || body.resale_price != null;

  if (becamePaused) {
    notificados = await notificarClientesML(id, product.name, "produto_pausado").catch(() => 0);
  } else if (contentChanged) {
    notificados = await notificarClientesML(id, product.name, "produto_editado").catch(() => 0);
  }

  return NextResponse.json({ ...updated, notificados });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  if (product.brand !== ctx.marcaSlug) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  /* notifica clientes antes de excluir */
  const notificados = await notificarClientesML(id, product.name, "produto_excluido").catch(() => 0);

  await deleteProduct(id);
  return NextResponse.json({ ok: true, notificados });
}
