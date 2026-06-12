import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Endpoint de teste: simula um webhook ML orders_v2 para um order_id específico.
 * Protegido por CRON_SECRET.
 *
 * Uso:
 *   POST /api/test/webhook-ml
 *   Authorization: Bearer <CRON_SECRET>
 *   Body: { "order_id": "12345678", "ml_user_id": "123456789" }
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth   = request.headers.get("authorization") ?? "";

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as {
    order_id:    string;
    ml_user_id:  string;
  };

  if (!body.order_id || !body.ml_user_id) {
    return NextResponse.json(
      { error: "Informe order_id e ml_user_id" },
      { status: 400 }
    );
  }

  /* Constrói o payload idêntico ao que o ML enviaria */
  const webhookPayload = {
    topic:       "orders_v2",
    resource:    `/orders/${body.order_id}`,
    user_id:     Number(body.ml_user_id),
    application_id: Number(process.env.ML_APP_ID ?? "0"),
  };

  /* Chama o próprio webhook handler interno */
  const origin  = new URL(request.url).origin;
  const res     = await fetch(`${origin}/api/webhooks/ml`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(webhookPayload),
  });

  const data = await res.json().catch(() => ({}));

  return NextResponse.json({
    simulado: webhookPayload,
    resultado: data,
    status: res.status,
  });
}
