import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

function verifyToken(id: string, action: string, brandSlug: string, exp: string, sig: string): boolean {
  const secret = process.env.EMAIL_ACTION_SECRET;
  if (!secret || !sig) return false;
  const expected = createHmac("sha256", secret)
    .update(`${id}:${action}:${brandSlug}:${exp}`)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(sig, "utf8"));
  } catch {
    return false;
  }
}

function htmlPage(ok: boolean, message: string, portalUrl?: string) {
  const color  = ok ? "#16a34a" : "#dc2626";
  const icon   = ok ? "✅" : "❌";
  const link   = portalUrl ? `<p style="margin:20px 0 0"><a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">Acessar painel</a></p>` : "";

  return new Response(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PH Representante</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="background:#fff;border-radius:16px;padding:48px 40px;max-width:400px;text-align:center;border:1px solid #e5e7eb;box-shadow:0 4px 20px rgba(0,0,0,.08)">
  <p style="margin:0 0 12px;font-size:48px">${icon}</p>
  <p style="margin:0 0 8px;font-size:20px;font-weight:900;color:#111">PH Representante</p>
  <p style="margin:0;font-size:14px;color:${color};font-weight:600">${message}</p>
  ${link}
</div>
</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id        = searchParams.get("id")     ?? "";
  const action    = searchParams.get("action") ?? "";
  const brandSlug = searchParams.get("brand")  ?? "";
  const exp       = searchParams.get("exp")    ?? "";
  const sig       = searchParams.get("sig")    ?? "";

  const portalUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/marca/pedidos/${id}`
    : undefined;

  if (!id || !action || !brandSlug || !exp || !sig) {
    return htmlPage(false, "Link inválido ou incompleto.");
  }

  // Check expiry
  if (Date.now() > Number(exp)) {
    return htmlPage(false, "Este link de ação expirou.", portalUrl);
  }

  // Verify HMAC
  if (!verifyToken(id, action, brandSlug, exp, sig)) {
    return htmlPage(false, "Assinatura inválida. Não foi possível executar a ação.");
  }

  if (action !== "confirmar_recebimento" && action !== "recusar") {
    return htmlPage(false, "Ação não reconhecida.");
  }

  const db = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: pedido } = await db
    .from("orcamentos")
    .select("id, status, tipo_pedido, cliente_id")
    .eq("id", id)
    .eq("marca", brandSlug)
    .single();

  if (!pedido) {
    return htmlPage(false, "Pedido não encontrado.", portalUrl);
  }
  if (pedido.status !== "enviado") {
    return htmlPage(false, "Este pedido já foi processado anteriormente.", portalUrl);
  }

  if (action === "confirmar_recebimento") {
    if (pedido.tipo_pedido === "dropshipping") {
      return htmlPage(false, "Pedidos dropshipping precisam ser aprovados no painel (verificação de etiquetas necessária).", portalUrl);
    }

    const { error } = await db.from("orcamentos").update({ status: "em_separacao" }).eq("id", id);
    if (error) return htmlPage(false, "Erro ao atualizar pedido. Tente pelo painel.", portalUrl);

    if (pedido.cliente_id) {
      await db.from("marca_clientes")
        .update({ status: "aprovado" })
        .eq("marca_slug", brandSlug)
        .eq("cliente_id", pedido.cliente_id as string);
    }

    return htmlPage(true, "Pedido aprovado com sucesso! Está agora em separação.", portalUrl);
  }

  if (action === "recusar") {
    const { error } = await db.from("orcamentos")
      .update({ status: "recusado", observacao_admin: "Recusado via link de email." })
      .eq("id", id);
    if (error) return htmlPage(false, "Erro ao recusar pedido. Tente pelo painel.", portalUrl);
    return htmlPage(true, "Pedido recusado.", portalUrl);
  }

  return htmlPage(false, "Ação desconhecida.");
}
