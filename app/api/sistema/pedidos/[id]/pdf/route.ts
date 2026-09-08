import { NextResponse } from "next/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { getPedidoDoc } from "@/lib/sistema/pedido-doc";
import { renderPedidoPdf } from "@/lib/sistema/pedido-pdf";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getSistemaProfile();
  if (!profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const doc = await getPedidoDoc(id);
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
