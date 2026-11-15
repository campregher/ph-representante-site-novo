import { NextResponse } from "next/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { baixarArquivoPedidoAdmin } from "@/lib/sistema/dropshipping-pedido-arquivos";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSistemaProfile();
  if (!profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const res = await baixarArquivoPedidoAdmin(id, "danfe");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  return new NextResponse(res.buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": res.contentType,
      "Content-Disposition": `inline; filename="${res.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
