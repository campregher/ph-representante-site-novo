import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getValidPortalToken } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

async function resolveLabel(shippingId: string, token: string): Promise<string | null> {
  const headers = { Authorization: `Bearer ${token}` };

  /* Tentativa 1: /labels?response_type=link (funciona para me1) */
  const r1 = await fetch(`${ML_BASE}/shipments/${shippingId}/labels?response_type=link`, { headers });
  if (r1.ok) {
    const ct = r1.headers.get("content-type") ?? "";
    if (ct.includes("json")) {
      const data = await r1.json().catch(() => null);
      if (typeof data === "string" && data.startsWith("http")) return data;
      const url = data?.label_url ?? data?.print_url ?? data?.url ?? null;
      if (url) return url;
    } else {
      const text = await r1.text().catch(() => "");
      if (text.trim().startsWith("http")) return text.trim();
    }
    if (r1.url !== `${ML_BASE}/shipments/${shippingId}/labels?response_type=link`) return r1.url;
  }

  /* Tentativa 2: /labels sem params (pode redirect) */
  const r2 = await fetch(`${ML_BASE}/shipments/${shippingId}/labels`, { headers });
  if (r2.ok) {
    const origUrl = `${ML_BASE}/shipments/${shippingId}/labels`;
    if (r2.url && r2.url !== origUrl) return r2.url;
    const ct2 = r2.headers.get("content-type") ?? "";
    if (ct2.includes("json")) {
      const data2 = await r2.json().catch(() => null);
      const url2 = data2?.label_url ?? data2?.print_url ?? data2?.url ?? null;
      if (url2) return url2;
    }
  }

  /* Tentativa 3: objeto do envio — tracking_number ou label_url direto */
  const r3 = await fetch(`${ML_BASE}/shipments/${shippingId}`, { headers });
  if (r3.ok) {
    const sh = await r3.json().catch(() => null);

    const directUrl = sh?.label_url ?? sh?.shipping_label?.url ?? null;
    if (directUrl) return directUrl;

    /* ME2 (drop_off / xd_drop_off / cross_docking): URL via tracking_number */
    const tracking = sh?.tracking_number ?? sh?.tracking_codes?.[0]?.code ?? null;
    if (tracking) {
      return `https://www.mercadolivre.com.br/envios/etiqueta/print/link/${tracking}`;
    }

    /* Fulfillment ou envio sem etiqueta para vendedor */
    const logisticType: string = sh?.logistic_type ?? "";
    if (logisticType === "fulfillment") {
      console.info(`[ml/etiqueta] shipment ${shippingId} é fulfillment — ML despacha sem etiqueta do vendedor`);
    } else {
      console.warn(`[ml/etiqueta] shipment ${shippingId} sem tracking_number. logistic_type=${logisticType} status=${sh?.status}`);
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

  const labelUrl = await resolveLabel(shippingId, token);

  if (!labelUrl) {
    return NextResponse.json(
      { error: "Etiqueta ainda não disponível — gere a etiqueta no Mercado Livre e tente novamente." },
      { status: 404 }
    );
  }

  /* Salva etiqueta no orcamento correspondente (background) */
  void (async () => {
    try {
      const db = await createAdminClient();
      const { data: cli } = await db.from("clientes").select("id").eq("user_id", user.id).single();
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
    } catch { /* não bloqueia resposta */ }
  })();

  return NextResponse.json({ url: labelUrl });
}
