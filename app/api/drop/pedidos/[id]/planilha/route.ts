import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { baixarArquivoPedidoSeller } from "@/lib/sistema/dropshipping-pedido-arquivos";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const seller = await requireSeller();
  const { id } = await params;
  const res = await baixarArquivoPedidoSeller(seller.id, id, "planilha");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  return new NextResponse(res.buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": res.contentType,
      "Content-Disposition": `attachment; filename="${res.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
