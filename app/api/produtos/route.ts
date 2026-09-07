import { NextResponse } from "next/server";
import { getProducts } from "@/lib/produtos";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get("marca") ?? undefined;
    const q = searchParams.get("q") ?? undefined;

    const products = await getProducts({ brand, q, activeOnly: true });
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
