import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { getPedidoDocByToken } from "@/lib/sistema/pedido-doc";
import { phLogoDataUri } from "@/lib/sistema/ph-logo";
import PedidoPDF from "@/components/pdf/PedidoPDF";

export const runtime = "nodejs";

/** PDF público do pedido — acessível por token, sem login. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const doc = await getPedidoDocByToken(token);
  if (!doc) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  doc.empresa.logo = await phLogoDataUri();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(PedidoPDF, { d: doc }) as any);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pedido-${doc.numero}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
