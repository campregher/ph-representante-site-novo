import { NextResponse } from "next/server";
import { createDropshippingAdminClient, createSistemaAdminClient } from "@/lib/supabase/server";
import { processarVendaDropshipping } from "@/lib/sistema/dropshipping-pedido-sync";
import { sincronizarAnuncioMLDrop } from "@/lib/sistema/dropshipping-ml-catalogo";
import { atualizarEnvioEDevolucaoPedido } from "@/lib/sistema/dropshipping-pedido-envio-status";
import { getMlContaInfo } from "@/lib/sistema/ml-auth";

export const runtime = "nodejs";

const PEDIDO_ENVIO_COLS = "id, canal, ml_conta_id, ml_shipping_id, pedido_externo, ml_envio_atualizado_em";

/**
 * Webhook de notificações do Mercado Livre (topic "orders_v2", "items",
 * "shipments", "post_purchase"). ML exige resposta 2xx rápida — sempre
 * retorna 200, mesmo em erro interno (senão ele fica reenviando). Topic
 * "orders_v2": resource vem no formato "/orders/{id}" — repassa pro
 * processamento de venda de dropshipping, que é idempotente (webhook reenvia
 * a mesma notificação várias vezes). Topic "items": resource vem como
 * "/items/{id}" — mantém dropshipping.seller_ml_anuncios sincronizado com o
 * status/preço real no ML (pausar/reativar/fechar/mudar preço direto no
 * painel do ML, fora do nosso portal). Topic "shipments": resource
 * "/shipments/{id}" — atualiza o status real de envio (ver
 * dropshipping-pedido-envio-status.ts). Topic "post_purchase": claim de
 * devolução/reclamação — formato do `resource` NUNCA confirmado ao vivo
 * (não há caso real pra testar ainda), tratado defensivamente (qualquer
 * falha só loga, nunca derruba o webhook). Esses 4 tópicos precisam estar
 * habilitados nas notificações do app no painel de desenvolvedores do ML.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    topic?: string;
    resource?: string;
    user_id?: number | string;
    application_id?: number | string;
  };

  console.log("[drop/ml/webhook]", JSON.stringify(body));

  if (body.topic === "orders_v2" && body.resource && body.user_id != null) {
    const orderId = body.resource.split("/").pop();
    if (orderId) {
      // aguarda de verdade (não fire-and-forget) — em serverless a função pode
      // ser encerrada assim que a resposta for enviada, matando uma promise pendente
      try {
        const res = await processarVendaDropshipping(String(body.user_id), orderId);
        if (!res.ok) console.error("[drop/ml/webhook] processarVendaDropshipping:", res.motivo);
      } catch (e) {
        console.error("[drop/ml/webhook] processarVendaDropshipping falhou:", e);
      }
    }
  }

  if (body.topic === "items" && body.resource) {
    const itemId = body.resource.split("/").pop();
    if (itemId) {
      try {
        await sincronizarAnuncioMLDrop(itemId);
      } catch (e) {
        console.error("[drop/ml/webhook] sincronizarAnuncioMLDrop falhou:", e);
      }
    }
  }

  if (body.topic === "shipments" && body.resource) {
    const shippingId = Number(body.resource.split("/").pop());
    if (Number.isFinite(shippingId)) {
      try {
        const db = await createDropshippingAdminClient();
        const { data: pedido } = await db
          .from("pedidos")
          .select(PEDIDO_ENVIO_COLS)
          .eq("ml_shipping_id", shippingId)
          .maybeSingle();
        if (pedido) await atualizarEnvioEDevolucaoPedido(db, pedido as never);
      } catch (e) {
        console.error("[drop/ml/webhook] atualizarEnvioEDevolucaoPedido (shipments) falhou:", e);
      }
    }
  }

  // Claim de devolução/reclamação — resource vem como "/post-purchase/v1/claims/{claim_id}",
  // que não traz o id do pedido direto. Resolve a conta ML do dono da notificação (mesmo
  // padrão de processarVendaDropshipping), busca o claim pra descobrir o pedido (resource_id)
  // e só então acha o pedido por pedido_externo — formato do claim nunca confirmado ao vivo,
  // qualquer coisa fora do esperado só loga e sai, nunca quebra o webhook.
  if (body.topic === "post_purchase" && body.resource && body.user_id != null) {
    const claimId = body.resource.split("/").pop();
    if (claimId) {
      try {
        const sistema = await createSistemaAdminClient();
        const { data: tokenRows } = await sistema
          .from("cliente_ml_tokens")
          .select("id")
          .eq("ml_user_id", String(body.user_id))
          .order("created_at", { ascending: false })
          .limit(1);
        const mlContaId = tokenRows?.[0]?.id as string | undefined;
        if (mlContaId) {
          const { token } = await getMlContaInfo(mlContaId);
          const res = await fetch(`https://api.mercadolibre.com/post-purchase/v1/claims/${claimId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const claim = await res.json();
            const orderId = String(claim.resource_id ?? "");
            const db = await createDropshippingAdminClient();
            const { data: pedido } = await db
              .from("pedidos")
              .select(PEDIDO_ENVIO_COLS)
              .eq("ml_conta_id", mlContaId)
              .eq("pedido_externo", orderId)
              .maybeSingle();
            if (pedido) await atualizarEnvioEDevolucaoPedido(db, pedido as never);
          }
        }
      } catch (e) {
        console.error("[drop/ml/webhook] atualizarEnvioEDevolucaoPedido (post_purchase) falhou:", e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/** ML às vezes testa a URL com GET antes de salvar a notificação. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
