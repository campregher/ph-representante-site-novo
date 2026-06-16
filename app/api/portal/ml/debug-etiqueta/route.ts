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

  /* 1. labels?response_type=link */
  try {
    const r = await fetch(`${ML_BASE}/shipments/${shippingId}/labels?response_type=link`, { headers });
    const body = await r.text();
    results["labels_response_type_link"] = {
      status: r.status,
      contentType: r.headers.get("content-type"),
      finalUrl: r.url,
      body: body.slice(0, 500),
    };
  } catch (e) { results["labels_response_type_link"] = { error: String(e) }; }

  /* 2. labels sem params */
  try {
    const r = await fetch(`${ML_BASE}/shipments/${shippingId}/labels`, { headers });
    const body = await r.text();
    results["labels_plain"] = {
      status: r.status,
      contentType: r.headers.get("content-type"),
      finalUrl: r.url,
      body: body.slice(0, 500),
    };
  } catch (e) { results["labels_plain"] = { error: String(e) }; }

  /* 3. shipment object */
  try {
    const r = await fetch(`${ML_BASE}/shipments/${shippingId}`, { headers });
    const body = await r.text();
    results["shipment"] = {
      status: r.status,
      body: body.slice(0, 1000),
    };
  } catch (e) { results["shipment"] = { error: String(e) }; }

  return NextResponse.json(results);
}
