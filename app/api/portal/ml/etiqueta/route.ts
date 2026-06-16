import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE     = "https://api.mercadolibre.com";
const ML_WEB_BASE = "https://www.mercadolivre.com.br";

type LabelResult =
  | { kind: "pdf"; data: ArrayBuffer; trackingNumber?: string }
  | { kind: "url"; value: string };

async function tryPdf(url: string, hdrs: Record<string, string> = {}): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url, { headers: { ...hdrs }, redirect: "follow" });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") ?? "";
    if (ct.includes("pdf") || ct.includes("octet-stream")) return r.arrayBuffer();
  } catch { /* ignora */ }
  return null;
}

async function tryUrlApi(url: string, hdrs: Record<string, string>): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: hdrs, redirect: "follow" });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") ?? "";
    if (ct.includes("json")) {
      const data = await r.json().catch(() => null);
      if (typeof data === "string" && data.startsWith("http")) return data;
      return data?.label_url ?? data?.print_url ?? data?.url ?? data?.urls?.[0]?.url ?? null;
    }
    if (ct.includes("text")) {
      const txt = await r.text().catch(() => "");
      if (txt.trim().startsWith("http")) return txt.trim();
    }
    if (r.url && r.url !== url) return r.url;
  } catch { /* ignora */ }
  return null;
}

async function resolveLabel(shippingId: string, token: string): Promise<LabelResult | null> {
  const auth = { Authorization: `Bearer ${token}` };

  /* ── 1. Pega ML user_id via /users/me ── */
  let mlUserId: string | null = null;
  try {
    const rMe = await fetch(`${ML_BASE}/users/me`, { headers: auth });
    if (rMe.ok) {
      const me = await rMe.json().catch(() => null);
      mlUserId = me?.id ? String(me.id) : null;
    }
  } catch { /* ignora */ }

  /* ── 2. Tentativas via API ML com variações ── */
  const apiAttempts: string[] = [];
  for (const rt of ["link", "pdf", "zpl2"]) {
    apiAttempts.push(`${ML_BASE}/shipments/${shippingId}/labels?response_type=${rt}`);
    if (mlUserId) {
      apiAttempts.push(
        `${ML_BASE}/shipments/${shippingId}/labels?response_type=${rt}&caller_id=${mlUserId}`,
        `${ML_BASE}/shipments/${shippingId}/labels?response_type=${rt}&caller.id=${mlUserId}`,
      );
    }
  }
  if (mlUserId) {
    apiAttempts.push(`${ML_BASE}/users/${mlUserId}/shipments/${shippingId}/labels?response_type=pdf`);
    apiAttempts.push(`${ML_BASE}/users/${mlUserId}/shipments/${shippingId}/labels?response_type=link`);
  }

  for (const u of apiAttempts) {
    const pdf = await tryPdf(u, auth);
    if (pdf) return { kind: "pdf", data: pdf };
    const url = await tryUrlApi(u, auth);
    if (url) return { kind: "url", value: url };
  }

  /* ── 3. POST batch labels ── */
  try {
    for (const rt of ["pdf", "link", "zpl2"]) {
      const r = await fetch(`${ML_BASE}/shipments/labels`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ shipment_ids: [shippingId], response_type: rt }),
      });
      if (r.ok) {
        const ct = r.headers.get("content-type") ?? "";
        if (ct.includes("pdf") || ct.includes("octet-stream")) return { kind: "pdf", data: await r.arrayBuffer() };
        const d = await r.json().catch(() => null);
        const u = d?.label_url ?? d?.url ?? null;
        if (u) return { kind: "url", value: u };
      }
    }
  } catch { /* ignora */ }

  /* ── 4. Objeto do envio completo ── */
  try {
    const r = await fetch(`${ML_BASE}/shipments/${shippingId}`, { headers: auth });
    if (!r.ok) return null;
    const sh = await r.json().catch(() => null);

    const directUrl = sh?.label_url
      ?? sh?.shipping_label?.url
      ?? sh?.carrier_info?.label_url
      ?? sh?.carrier_info?.print_url
      ?? sh?.carrier_info?.url
      ?? null;
    if (directUrl) return { kind: "url", value: directUrl };

    const tracking: string | null = sh?.tracking_number ?? sh?.tracking_codes?.[0]?.code ?? null;

    if (tracking) {
      /* Fallback: página da venda no ML onde o seller tem o botão "Reimprimir etiqueta" */
      const orderId: string | null = sh?.order_id ? String(sh.order_id) : null;
      const fallbackUrl = orderId
        ? `${ML_WEB_BASE}/vendas/${orderId}/detalhe`
        : `${ML_WEB_BASE}/envios/${shippingId}`;
      console.warn(`[ml/etiqueta] ${shippingId} tracking=${tracking} — URL fallback: ${fallbackUrl}`);
      return { kind: "url", value: fallbackUrl };
    }

    console.warn(`[ml/etiqueta] ${shippingId} sem tracking. mode=${sh?.mode} logistic_type=${sh?.logistic_type}`);
  } catch (e) {
    console.error("[ml/etiqueta] error:", e);
  }

  return null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const shippingId = searchParams.get("shipping_id");
  if (!shippingId) return NextResponse.json({ error: "shipping_id obrigatório" }, { status: 400 });

  const token = await getValidPortalToken(user.id).catch(() => null);
  if (!token) return NextResponse.json({ error: "Conta ML não conectada" }, { status: 403 });

  const result = await resolveLabel(shippingId, token);

  if (!result) {
    return NextResponse.json(
      { error: "Etiqueta ainda não disponível — gere a etiqueta no Mercado Livre e tente novamente." },
      { status: 404 }
    );
  }

  if (result.kind === "pdf") {
    if (result.trackingNumber) {
      void saveEtiqueta(shippingId, user.id, `${ML_WEB_BASE}/envios/etiqueta/print/link/${result.trackingNumber}`);
    }
    return new Response(result.data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="etiqueta-${shippingId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  void saveEtiqueta(shippingId, user.id, result.value);
  return NextResponse.json({ url: result.value });
}

/* ── Upload manual do PDF pelo cliente ── */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const form = await request.formData();
  const file       = form.get("file") as File | null;
  const shippingId = form.get("shipping_id") as string | null;

  if (!file || !shippingId) {
    return NextResponse.json({ error: "file e shipping_id são obrigatórios" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
    return NextResponse.json({ error: "Apenas arquivos PDF são aceitos" }, { status: 400 });
  }

  const db      = await createAdminClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path     = `${user.id}/${Date.now()}-${safeName}`;
  const buffer   = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await db.storage
    .from("etiquetas")
    .upload(path, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = db.storage.from("etiquetas").getPublicUrl(path);
  await saveEtiqueta(shippingId, user.id, publicUrl);

  return NextResponse.json({ url: publicUrl });
}

async function saveEtiqueta(shippingId: string, userId: string, labelUrl: string) {
  try {
    const db = await createAdminClient();
    const { data: cli } = await db.from("clientes").select("id").eq("user_id", userId).single();
    if (!cli) return;
    const { data: orc } = await db
      .from("orcamentos")
      .select("id, ml_order_id, orcamento_etiquetas(id)")
      .eq("ml_shipping_id", shippingId)
      .eq("cliente_id", cli.id)
      .maybeSingle();
    if (!orc) return;
    const existing = (orc.orcamento_etiquetas ?? []) as { id: string }[];
    if (existing.length > 0) {
      await db.from("orcamento_etiquetas").update({ url: labelUrl }).eq("id", existing[0].id);
    } else {
      await db.from("orcamento_etiquetas").insert({
        orcamento_id: orc.id,
        nome: `Etiqueta ML #${orc.ml_order_id ?? shippingId}`,
        url:  labelUrl,
      });
    }
  } catch { /* não bloqueia */ }
}
