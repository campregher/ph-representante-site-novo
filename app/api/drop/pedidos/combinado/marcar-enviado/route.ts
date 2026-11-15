import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { marcarPedidosEnviados } from "@/lib/sistema/dropshipping-pedido-combinado";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const seller = await requireSeller();
  const body = await req.json().catch(() => null);
  const pedidoIds = Array.isArray(body?.pedidoIds)
    ? body.pedidoIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  if (pedidoIds.length === 0) return NextResponse.json({ error: "Nenhum pedido selecionado." }, { status: 400 });

  const atualizados = await marcarPedidosEnviados(seller.id, pedidoIds);
  return NextResponse.json({ atualizados });
}
