import { NextResponse } from "next/server";
import { processarVendaML } from "@/lib/sistema/ml-pedido-sync";

export const runtime = "nodejs";

/**
 * Webhook de notificações do Mercado Livre (topic "orders_v2", "shipments", etc).
 * ML exige resposta 2xx rápida — sempre retorna 200, mesmo em erro interno
 * (senão ele fica reenviando). Topic "orders_v2": resource vem no formato
 * "/orders/{id}" — repassa pro processamento de venda (D6), que é idempotente
 * (webhook reenvia a mesma notificação várias vezes).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    topic?: string;
    resource?: string;
    user_id?: number | string;
    application_id?: number | string;
  };

  console.log("[drop/ml/webhook]", JSON.stringify(body));

  if (body.topic === "orders_v2" && body.resource && body.user_id != null) {
    const orderId = body.resource.split("/").pop();
    if (orderId) {
      // aguarda de verdade (não fire-and-forget) — em serverless a função pode
      // ser encerrada assim que a resposta for enviada, matando uma promise pendente
      try {
        const res = await processarVendaML(String(body.user_id), orderId);
        if (!res.ok) console.error("[drop/ml/webhook] processarVendaML:", res.motivo);
      } catch (e) {
        console.error("[drop/ml/webhook] processarVendaML falhou:", e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/** ML às vezes testa a URL com GET antes de salvar a notificação. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
