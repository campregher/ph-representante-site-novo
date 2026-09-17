import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Webhook de notificações do Mercado Livre (topic "orders_v2", "shipments", etc).
 * ML exige resposta 2xx rápida — sempre retorna 200, mesmo em erro interno
 * (senão ele fica reenviando). Por enquanto só REGISTRA no log do servidor;
 * a geração automática de pedido a partir da venda é Fase D (depende do
 * vínculo produto↔anúncio, que ainda não existe).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    topic?: string;
    resource?: string;
    user_id?: number | string;
    application_id?: number | string;
  };

  console.log("[drop/ml/webhook]", JSON.stringify(body));

  return NextResponse.json({ ok: true });
}

/** ML às vezes testa a URL com GET antes de salvar a notificação. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
