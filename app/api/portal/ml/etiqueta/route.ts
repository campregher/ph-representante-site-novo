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

  /* ── Tentativas via API ML ── */
  for (const responseType of ["link", "pdf", "zpl2"]) {
    const u = `${ML_BASE}/shipments/${shippingId}/labels?response_type=${responseType}`;
    const pdf = await tryPdf(u, auth);
    if (pdf) return { kind: "pdf", data: pdf };
    const url = await tryUrlApi(u, auth);
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
      const d = await r.json().catch(() => null);
      const u = d?.label_url ?? d?.url ?? null;
      if (u) return { kind: "url", value: u };
    }
  } catch { /* ignora */ }

  /* ── Objeto do envio completo ── */
  try {
    const r = await fetch(`${ML_BASE}/shipments/${shippingId}`, { headers: auth });
    if (!r.ok) return null;
    const sh = await r.json().catch(() => null);

    /* Log para diagnóstico */
    console.info("[ml/etiqueta] carrier_info:", JSON.stringify(sh?.carrier_info ?? null));
    console.info("[ml/etiqueta] tracking_method:", sh?.tracking_method);
    console.info("[ml/etiqueta] tags:", JSON.stringify(sh?.tags ?? null));

    /* Campos diretos */
    const directUrl = sh?.label_url
      ?? sh?.shipping_label?.url
      ?? sh?.carrier_info?.label_url
      ?? sh?.carrier_info?.print_url
      ?? sh?.carrier_info?.url
      ?? null;
    if (directUrl) return { kind: "url", value: directUrl };

    const tracking: string | null = sh?.tracking_number ?? sh?.tracking_codes?.[0]?.code ?? null;

    if (tracking) {
      const trackingUrl = `${ML_WEB_BASE}/envios/etiqueta/print/link/${tracking}`;

      /* Tenta PDF com Accept: application/pdf */
      const pdfDirect = await tryPdf(trackingUrl, { ...auth, Accept: "application/pdf" });
      if (pdfDirect) return { kind: "pdf", data: pdfDirect, trackingNumber: tracking };

      /* Tenta fetch com headers de browser para ver o HTML */
      try {
        const rHtml = await fetch(trackingUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            ...auth,
          },
          redirect: "follow",
        });
        console.info(`[ml/etiqueta] html status=${rHtml.status} ct=${rHtml.headers.get("content-type")} finalUrl=${rHtml.url}`);
        if (rHtml.ok) {
          const ct = rHtml.headers.get("content-type") ?? "";
          if (ct.includes("pdf")) return { kind: "pdf", data: await rHtml.arrayBuffer(), trackingNumber: tracking };

          const html = await rHtml.text();
          console.info("[ml/etiqueta] html preview:", html.slice(0, 800));

          /* Procura URL de PDF no HTML */
          const pdfInHtml = html.match(/https?:\/\/[^\s"'<>]*(?:pdf|label|etiqueta)[^\s"'<>]*/i)?.[0];
          if (pdfInHtml) {
            console.info("[ml/etiqueta] found in HTML:", pdfInHtml);
            const pdfFromHtml = await tryPdf(pdfInHtml, auth);
            if (pdfFromHtml) return { kind: "pdf", data: pdfFromHtml, trackingNumber: tracking };
            return { kind: "url", value: pdfInHtml };
          }

          /* Procura em JSON embutido no HTML */
          const jsonMatch = html.match(/"(?:label|print|etiqueta)_?[Uu]rl"\s*:\s*"([^"]+)"/);
          if (jsonMatch?.[1]) {
            return { kind: "url", value: jsonMatch[1] };
          }
        }
      } catch (e) {
        console.warn("[ml/etiqueta] html fetch error:", e);
      }

      /* Sem PDF disponível via API — retorna URL para abrir no browser */
      console.warn(`[ml/etiqueta] ${shippingId} tracking=${tracking} — retornando URL fallback`);
      return { kind: "url", value: trackingUrl };
    }

    console.warn(`[ml/etiqueta] ${shippingId} sem tracking. logistic_type=${sh?.logistic_type}`);
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
