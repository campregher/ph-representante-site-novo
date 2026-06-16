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

/* Tenta obter PDF de uma URL; retorna ArrayBuffer ou null */
async function tryPdf(url: string, hdrs: Record<string, string> = {}): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url, { headers: { Accept: "application/pdf,*/*", ...hdrs }, redirect: "follow" });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") ?? "";
    if (ct.includes("pdf") || ct.includes("octet-stream")) return r.arrayBuffer();
    /* Seguiu redirect para URL diferente com PDF */
    if (r.url && r.url !== url) {
      const r2 = await fetch(r.url, { headers: { Accept: "application/pdf,*/*" } });
      if (r2.ok) {
        const ct2 = r2.headers.get("content-type") ?? "";
        if (ct2.includes("pdf") || ct2.includes("octet-stream")) return r2.arrayBuffer();
      }
    }
  } catch { /* ignora */ }
  return null;
}

/* Tenta obter URL de texto de uma resposta ML */
async function tryUrl(url: string, hdrs: Record<string, string>): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json", ...hdrs } });
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

async function resolveLabel(shippingId: string, token: string, mlUserId?: string): Promise<LabelResult | null> {
  const auth = { Authorization: `Bearer ${token}` };

  /* ── Tentativas via API ML ── */
  for (const responseType of ["link", "pdf", "zpl2"] as const) {
    const pdf = await tryPdf(`${ML_BASE}/shipments/${shippingId}/labels?response_type=${responseType}`, auth);
    if (pdf) return { kind: "pdf", data: pdf };

    const url = await tryUrl(`${ML_BASE}/shipments/${shippingId}/labels?response_type=${responseType}`, auth);
    if (url) return { kind: "url", value: url };
  }

  /* ── POST batch labels ── */
  try {
    const r = await fetch(`${ML_BASE}/shipments/labels`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ shipment_ids: [shippingId], response_type: "pdf" }),
    });
    if (r.ok) {
      const ct = r.headers.get("content-type") ?? "";
      if (ct.includes("pdf") || ct.includes("octet-stream")) return { kind: "pdf", data: await r.arrayBuffer() };
      if (ct.includes("json")) {
        const d = await r.json().catch(() => null);
        const u = d?.label_url ?? d?.url ?? null;
        if (u) return { kind: "url", value: u };
      }
    }
  } catch { /* ignora */ }

  /* ── Objeto do envio → tracking_number ── */
  try {
    const r = await fetch(`${ML_BASE}/shipments/${shippingId}`, { headers: auth });
    if (r.ok) {
      const sh = await r.json().catch(() => null);

      const directUrl = sh?.label_url ?? sh?.shipping_label?.url ?? null;
      if (directUrl) return { kind: "url", value: directUrl };

      const tracking: string | null = sh?.tracking_number ?? sh?.tracking_codes?.[0]?.code ?? null;

      if (tracking) {
        const trackingUrl = `${ML_WEB_BASE}/envios/etiqueta/print/link/${tracking}`;

        /* 1. Tenta PDF via URL pública (sem auth) */
        const pdfPublic = await tryPdf(trackingUrl);
        if (pdfPublic) return { kind: "pdf", data: pdfPublic, trackingNumber: tracking };

        /* 2. Tenta PDF com token OAuth */
        const pdfAuth = await tryPdf(trackingUrl, auth);
        if (pdfAuth) return { kind: "pdf", data: pdfAuth, trackingNumber: tracking };

        /* 3. Tenta URL alternativas de print */
        for (const altUrl of [
          `${ML_WEB_BASE}/envios/etiqueta/imprimir/${tracking}`,
          `${ML_WEB_BASE}/checkout/v1/logistic/print/label/${shippingId}`,
          `${ML_WEB_BASE}/checkout/v1/logistic/print/pdf/${shippingId}`,
        ]) {
          const pdfAlt = await tryPdf(altUrl, auth);
          if (pdfAlt) return { kind: "pdf", data: pdfAlt, trackingNumber: tracking };
        }

        /* Fallback: retorna URL para abrir no browser */
        console.warn(`[ml/etiqueta] ${shippingId} tracking=${tracking} — nenhum PDF encontrado, retornando URL`);
        return { kind: "url", value: trackingUrl };
      }

      const logisticType: string = sh?.logistic_type ?? "";
      console.warn(`[ml/etiqueta] ${shippingId} sem tracking. logistic_type=${logisticType} status=${sh?.status} keys=${JSON.stringify(Object.keys(sh ?? {}))}`);
    }
  } catch (e) {
    console.error("[ml/etiqueta] shipment fetch error:", e);
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
