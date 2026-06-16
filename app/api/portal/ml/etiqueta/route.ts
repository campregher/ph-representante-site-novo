import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
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

  /* Salva etiqueta no orcamento correspondente (em background, não bloqueia resposta) */
  const db = await createAdminClient();
  db.from("clientes").select("id").eq("user_id", user.id).single().then(({ data: cli }) => {
    if (!cli) return;
    return db.from("orcamentos")
      .select("id, ml_order_id, orcamento_etiquetas(id)")
      .eq("ml_shipping_id", shippingId)
      .eq("cliente_id", cli.id)
      .maybeSingle()
      .then(({ data: orc }) => {
        if (!orc) return;
        const existing = (orc.orcamento_etiquetas ?? []) as { id: string }[];
        if (existing.length > 0) {
          /* Atualiza URL se já existia */
          return db.from("orcamento_etiquetas")
            .update({ url: labelUrl })
            .eq("id", existing[0].id);
        }
        return db.from("orcamento_etiquetas").insert({
          orcamento_id: orc.id,
          nome:         `Etiqueta ML #${orc.ml_order_id ?? shippingId}`,
          url:          labelUrl,
        });
      });
  }).catch(() => {});

  return NextResponse.json({ url: labelUrl });
}
