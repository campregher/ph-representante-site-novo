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
  if (!token) return NextResponse.json({ error: "Conta ML não conectada" }, { status: 403 });

  const res = await fetch(
    `${ML_BASE}/shipments/${shippingId}/labels?response_type=link`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[ml/etiqueta] failed", res.status, body.slice(0, 200));
    return NextResponse.json({ error: "Etiqueta não disponível no momento" }, { status: 404 });
  }

  const data = await res.json().catch(() => null);
  const labelUrl = typeof data === "string" ? data : (data?.label_url ?? data?.print_url ?? null);

  if (!labelUrl) return NextResponse.json({ error: "URL da etiqueta não encontrada" }, { status: 404 });

  return NextResponse.json({ url: labelUrl });
}
