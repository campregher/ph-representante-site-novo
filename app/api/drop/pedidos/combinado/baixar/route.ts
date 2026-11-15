import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { gerarPacoteCombinado } from "@/lib/sistema/dropshipping-pedido-combinado";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const seller = await requireSeller();
  const body = await req.json().catch(() => null);
  const pedidoIds = Array.isArray(body?.pedidoIds)
    ? body.pedidoIds.filter((x: unknown): x is string => typeof x === "string")
    : [];

  const pacote = await gerarPacoteCombinado(seller.id, pedidoIds);
  if (!pacote.ok) return NextResponse.json({ error: pacote.erro }, { status: 400 });

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("etiquetas-combinadas.pdf", pacote.etiquetas);
  zip.file("notas-fiscais-combinadas.pdf", pacote.danfes);
  zip.file("planilha-combinada.xlsx", pacote.planilha);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="pedidos-combinados.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
