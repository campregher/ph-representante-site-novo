import { NextResponse } from "next/server";
import { buscarOndeComprar } from "@/lib/public/onde-comprar";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const produtos = await buscarOndeComprar(q);
  return NextResponse.json(produtos);
}
