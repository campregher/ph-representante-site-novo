import { NextResponse } from "next/server";
import { getProducts, createProduct } from "@/lib/produtos";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get("marca") ?? undefined;
    const q = searchParams.get("q") ?? undefined;
    const activeOnly = searchParams.get("admin") !== "1";

    const products = await getProducts({ brand, q, activeOnly });
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE)?.value ?? "";
    if (!(await verifyToken(token))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json();
    const product = await createProduct(body);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
