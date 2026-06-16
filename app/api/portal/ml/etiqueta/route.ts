import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE    = "https://api.mercadolibre.com";
const ML_WEB_BASE = "https://www.mercadolivre.com.br";

type LabelResult =
  | { kind: "url";  url: ArrayBuffer | null; value: string }
  | { kind: "pdf";  data: ArrayBuffer; trackingNumber?: string };

async function resolveLabel(shippingId: string, token: string): Promise<LabelResult | null> {
  const headers = { Authorization: `Bearer ${token}` };

  /* ── 1. response_type=link (ME1 / alguns ME2) ── */
  const r1 = await fetch(`${ML_BASE}/shipments/${shippingId}/labels?response_type=link`, { headers });
  if (r1.ok) {
    const ct = r1.headers.get("content-type") ?? "";
    if (ct.includes("application/pdf") || ct.includes("octet-stream")) {
      return { kind: "pdf", data: await r1.arrayBuffer() };
    }
    if (ct.includes("json")) {
      const data = await r1.json().catch(() => null);
      const url = typeof data === "string" ? data : (data?.label_url ?? data?.print_url ?? data?.url ?? null);
      if (url) return { kind: "url", value: url, url: null };
    } else {
      const text = await r1.text().catch(() => "");
      if (text.trim().startsWith("http")) return { kind: "url", value: text.trim(), url: null };
    }
    if (r1.url !== `${ML_BASE}/shipments/${shippingId}/labels?response_type=link`)
      return { kind: "url", value: r1.url, url: null };
  }

  /* ── 2. response_type=pdf (proxy direto) ── */
  const r2 = await fetch(`${ML_BASE}/shipments/${shippingId}/labels?response_type=pdf`, { headers });
  if (r2.ok) {
    const ct2 = r2.headers.get("content-type") ?? "";
    if (ct2.includes("application/pdf") || ct2.includes("octet-stream") || ct2.includes("zip")) {
      return { kind: "pdf", data: await r2.arrayBuffer() };
    }
    if (r2.url !== `${ML_BASE}/shipments/${shippingId}/labels?response_type=pdf`)
      return { kind: "url", value: r2.url, url: null };
  }

  /* ── 3. response_type=zpl2 (converte ZPL → não disponível, tenta mesmo assim) ── */
  const r3 = await fetch(`${ML_BASE}/shipments/${shippingId}/labels?response_type=zpl2`, { headers });
  if (r3.ok) {
    const ct3 = r3.headers.get("content-type") ?? "";
    if (ct3.includes("pdf") || ct3.includes("octet-stream")) {
      return { kind: "pdf", data: await r3.arrayBuffer() };
    }
  }

  /* ── 4. Objeto do envio → tracking_number para proxy via API ML web ── */
  const r4 = await fetch(`${ML_BASE}/shipments/${shippingId}`, { headers });
  if (r4.ok) {
    const sh = await r4.json().catch(() => null);

    const directUrl = sh?.label_url ?? sh?.shipping_label?.url ?? null;
    if (directUrl) return { kind: "url", value: directUrl, url: null };

    const tracking: string | null = sh?.tracking_number ?? sh?.tracking_codes?.[0]?.code ?? null;

    if (tracking) {
      /* Tenta buscar o PDF direto pela API de impressão ML usando o token OAuth */
      const pdfUrl = `${ML_WEB_BASE}/envios/etiqueta/print/link/${tracking}`;
      const rPdf = await fetch(pdfUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/pdf,*/*",
        },
        redirect: "follow",
      });

      if (rPdf.ok) {
        const ct = rPdf.headers.get("content-type") ?? "";
        if (ct.includes("pdf") || ct.includes("octet-stream")) {
          return { kind: "pdf", data: await rPdf.arrayBuffer(), trackingNumber: tracking };
        }
        /* Seguiu redirect para URL diferente — retorna essa URL */
        if (rPdf.url && rPdf.url !== pdfUrl) {
          return { kind: "url", value: rPdf.url, url: null };
        }
      }

      /* Nenhum método retornou PDF — devolve URL de fallback para abrir no browser */
      return { kind: "url", value: pdfUrl, url: null };
    }

    const logisticType: string = sh?.logistic_type ?? "";
    if (logisticType === "fulfillment") {
      console.info(`[ml/etiqueta] shipment ${shippingId} fulfillment — sem etiqueta do vendedor`);
    } else {
      console.warn(`[ml/etiqueta] shipment ${shippingId} sem tracking. logistic_type=${logisticType} status=${sh?.status}`);
    }
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

  /* ── PDF binário: proxy direto ── */
  if (result.kind === "pdf") {
    /* Salva tracking URL no orcamento em background */
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

  /* ── URL: salva e retorna ── */
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
        nome:         `Etiqueta ML #${orc.ml_order_id ?? shippingId}`,
        url:          labelUrl,
      });
    }
  } catch { /* não bloqueia */ }
}
