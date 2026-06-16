import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const shippingId = searchParams.get("shipping_id");
  if (!shippingId) return NextResponse.json({ error: "shipping_id obrigatório" }, { status: 400 });

  const token = await getValidPortalToken(user.id).catch(() => null);
  if (!token) return NextResponse.json({ error: "Token ML inválido" }, { status: 403 });

  const headers = { Authorization: `Bearer ${token}` };
  const results: Record<string, unknown> = {};

  /* 1. Shipment completo */
  let senderId: string | null = null;
  let trackingNumber: string | null = null;
  try {
    const r = await fetch(`${ML_BASE}/shipments/${shippingId}`, { headers });
    const body = await r.json().catch(() => null);
    senderId = body?.sender_id ? String(body.sender_id) : null;
    trackingNumber = body?.tracking_number ?? body?.tracking_codes?.[0]?.code ?? null;
    results["shipment"] = {
      status: r.status,
      sender_id: senderId,
      tracking_number: trackingNumber,
      status_field: body?.status,
      substatus: body?.substatus,
      mode: body?.mode,
      label_url: body?.label_url ?? null,
      shipping_label: body?.shipping_label ?? null,
      logistic_type: body?.logistic_type ?? null,
      all_keys: Object.keys(body ?? {}),
    };
  } catch (e) { results["shipment"] = { error: String(e) }; }

  /* 2. labels?response_type=link */
  try {
    const r = await fetch(`${ML_BASE}/shipments/${shippingId}/labels?response_type=link`, { headers });
    const body = await r.text();
    results["labels_link"] = { status: r.status, contentType: r.headers.get("content-type"), body: body.slice(0, 300) };
  } catch (e) { results["labels_link"] = { error: String(e) }; }

  /* 3. labels sem params */
  try {
    const r = await fetch(`${ML_BASE}/shipments/${shippingId}/labels`, { headers });
    const body = await r.text();
    results["labels_plain"] = { status: r.status, contentType: r.headers.get("content-type"), finalUrl: r.url, body: body.slice(0, 300) };
  } catch (e) { results["labels_plain"] = { error: String(e) }; }

  /* 4. labels via user endpoint (ME2) */
  if (senderId) {
    try {
      const r = await fetch(`${ML_BASE}/users/${senderId}/shipments/${shippingId}/labels?response_type=link`, { headers });
      const body = await r.text();
      results["labels_user_path"] = { status: r.status, contentType: r.headers.get("content-type"), body: body.slice(0, 300) };
    } catch (e) { results["labels_user_path"] = { error: String(e) }; }
  }

  /* 5. labels com caller_id */
  if (senderId) {
    try {
      const r = await fetch(`${ML_BASE}/shipments/${shippingId}/labels?response_type=link&caller_id=${senderId}`, { headers });
      const body = await r.text();
      results["labels_caller_id"] = { status: r.status, body: body.slice(0, 300) };
    } catch (e) { results["labels_caller_id"] = { error: String(e) }; }
  }

  /* 6. URL por tracking_number */
  if (trackingNumber) {
    results["tracking_label_url"] = `https://www.mercadolivre.com.br/envios/etiqueta/print/link/${trackingNumber}`;
  }

  return NextResponse.json(results);
}
