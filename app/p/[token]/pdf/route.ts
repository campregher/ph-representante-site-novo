import { NextResponse } from "next/server";
import { getPedidoDocByToken } from "@/lib/sistema/pedido-doc";
import { renderPedidoPdf } from "@/lib/sistema/pedido-pdf";

export const runtime = "nodejs";

/** PDF público do pedido — acessível por token, sem login. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const doc = await getPedidoDocByToken(token);
  if (!doc) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const buffer = await renderPedidoPdf(doc);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pedido-${doc.numero}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
