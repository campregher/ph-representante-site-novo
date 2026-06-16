import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";
const ML  = "https://api.mercadolibre.com";
const WEB = "https://www.mercadolivre.com.br";

async function probe(label: string, url: string, opts: RequestInit = {}) {
  try {
    const r = await fetch(url, { ...opts, redirect: "follow" });
    const ct = r.headers.get("content-type") ?? "";
    let body: unknown = `[binary ${r.headers.get("content-length") ?? "?"}b]`;
    if (ct.includes("json")) body = await r.json().catch(() => null);
    else if (ct.includes("text") || ct.includes("html")) body = (await r.text()).slice(0, 400);
    return { label, status: r.status, ct, finalUrl: r.url !== url ? r.url : undefined, body };
  } catch (e) {
    return { label, error: String(e) };
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const orderId    = searchParams.get("order_id");
  const shippingId = searchParams.get("shipping_id");
  if (!orderId && !shippingId) {
    return NextResponse.json({ error: "Passe order_id ou shipping_id" }, { status: 400 });
  }

  const token = await getValidPortalToken(user.id).catch(() => null);
  if (!token) return NextResponse.json({ error: "ML não conectado" }, { status: 403 });
  const auth = { Authorization: `Bearer ${token}` };

  /* ── Resolve IDs ── */
  let sid = shippingId ?? "";
  let oid = orderId ?? "";
  let tracking = "";
  let mlUserId = "";

  const meRes = await fetch(`${ML}/users/me`, { headers: auth });
  if (meRes.ok) { const me = await meRes.json(); mlUserId = String(me.id ?? ""); }

  if (oid && !sid) {
    const or = await fetch(`${ML}/orders/${oid}`, { headers: auth });
    if (or.ok) { const o = await or.json(); sid = String(o?.shipping?.id ?? ""); }
  }
  if (sid) {
    const sr = await fetch(`${ML}/shipments/${sid}`, { headers: auth });
    if (sr.ok) {
      const s = await sr.json();
      tracking = s?.tracking_number ?? "";
      if (!oid) oid = String(s?.order_id ?? "");
    }
  }

  const results = await Promise.all([
    /* Pela venda */
    oid && probe("order_shipment",         `${ML}/orders/${oid}/shipments`, { headers: auth }),
    oid && probe("order_labels",           `${ML}/orders/${oid}/labels`, { headers: auth }),
    oid && probe("order_labels_pdf",       `${ML}/orders/${oid}/labels?response_type=pdf`, { headers: auth }),

    /* Shipment labels — variações */
    sid && probe("ship_link",              `${ML}/shipments/${sid}/labels?response_type=link`, { headers: auth }),
    sid && probe("ship_pdf",               `${ML}/shipments/${sid}/labels?response_type=pdf`, { headers: auth }),
    sid && probe("ship_pdf_caller",        `${ML}/shipments/${sid}/labels?response_type=pdf&caller_id=${mlUserId}`, { headers: auth }),
    sid && probe("ship_pdf_caller_dot",    `${ML}/shipments/${sid}/labels?response_type=pdf&caller.id=${mlUserId}`, { headers: auth }),
    sid && probe("ship_link_caller_dot",   `${ML}/shipments/${sid}/labels?response_type=link&caller.id=${mlUserId}`, { headers: auth }),
    sid && probe("ship_label_singular",    `${ML}/shipments/${sid}/label`, { headers: auth }),
    sid && probe("ship_labels_v2",         `${ML}/v2/shipments/${sid}/labels`, { headers: auth }),
    sid && probe("ship_labels_post",       `${ML}/shipments/${sid}/labels`, { headers: auth, method: "POST", body: JSON.stringify({ response_type: "pdf" }) }),

    /* Pelo usuário ML */
    sid && mlUserId && probe("user_ship_labels",    `${ML}/users/${mlUserId}/shipments/${sid}/labels?response_type=pdf`, { headers: auth }),
    sid && mlUserId && probe("user_ship_labels_lnk",`${ML}/users/${mlUserId}/shipments/${sid}/labels?response_type=link`, { headers: auth }),

    /* Mercado Envios específico */
    sid && probe("me_flex",                `${ML}/shipments/flex/${sid}/labels`, { headers: auth }),
    sid && probe("me_labels_batch_post",   `${ML}/shipments/labels`, {
      headers: { ...auth, "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({ shipment_ids: [Number(sid)], response_type: "pdf", caller_id: Number(mlUserId) }),
    }),
    sid && probe("me_labels_batch_link",   `${ML}/shipments/labels`, {
      headers: { ...auth, "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({ shipment_ids: [Number(sid)], response_type: "link", caller_id: Number(mlUserId) }),
    }),

    /* Web URLs com token */
    tracking && probe("web_link_noauth",   `${WEB}/envios/etiqueta/print/link/${tracking}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0" },
    }),
    tracking && probe("web_link_token",    `${WEB}/envios/etiqueta/print/link/${tracking}?access_token=${token}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0" },
    }),
    tracking && probe("web_pdf",           `${WEB}/envios/etiqueta/print/pdf/${tracking}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0" },
    }),
    tracking && probe("correios_tracking", `https://rastreamento.correios.com.br/app/index.php?objetos=${tracking}`, {}),
  ]);

  return NextResponse.json({
    resolved: { oid, sid, tracking, mlUserId },
    results:  results.filter(Boolean),
  });
}
