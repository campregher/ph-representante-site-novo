import { createDropshippingAdminClient, createSistemaAdminClient } from "@/lib/supabase/server";
import { gerarPacoteCombinado, marcarPedidosEnviados } from "@/lib/sistema/dropshipping-pedido-combinado";
import { sendEmail, resendConfigurado } from "@/lib/email/resend";
import { criarNotificacoes } from "@/lib/sistema/notificacoes";

/**
 * Envio automático do pacote combinado (etiquetas + planilha, sem NF — o
 * fornecedor não precisa dela, mesma regra de `gerarPacoteCombinado`) pro
 * e-mail do fornecedor, assim que os pedidos ficam "pronto" — sem o seller
 * precisar baixar e mandar manual no WhatsApp (ver migration 056).
 *
 * Só roda quando o fornecedor tem e-mail cadastrado E um intervalo mínimo
 * configurado (`envio_automatico_intervalo_min`, ajustável por fornecedor em
 * "Fornecedores" — null/vazio = desativado, continua 100% manual). Pra não
 * picotar e-mail toda hora, junta TODOS os pedidos "pronto" ainda não
 * enviados desse fornecedor+seller num pacote só, no máximo 1 lote a cada
 * "intervalo_min" minutos por fornecedor — trava gravada em
 * `envio_automatico_ultimo_em`, reclamada de forma atômica (update
 * condicional) pra não mandar em dobro se duas requisições caírem juntas
 * (ex.: auto-refresh da página batendo quase ao mesmo tempo).
 *
 * Nunca lança: chamado de dentro do carregamento normal da página de
 * Pedidos, uma falha aqui não pode quebrar a página de quem só queria ver
 * os pedidos.
 */

interface FornecedorEnvioAuto {
  id: string;
  nome: string;
  email: string | null;
  envio_automatico_intervalo_min: number | null;
}

/** Tenta reclamar o direito de mandar agora — só retorna true se realmente
 *  estava devido (sem corrida: o update só "pega" quando a condição ainda
 *  vale no banco no momento exato do UPDATE). */
async function reclamarEnvio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drop: any,
  fornecedorId: string,
  intervaloMin: number
): Promise<boolean> {
  const limiar = new Date(Date.now() - intervaloMin * 60 * 1000).toISOString();
  const agora = new Date().toISOString();
  const { data } = await drop
    .from("fornecedores")
    .update({ envio_automatico_ultimo_em: agora })
    .eq("id", fornecedorId)
    .or(`envio_automatico_ultimo_em.is.null,envio_automatico_ultimo_em.lt.${limiar}`)
    .select("id");
  return (data ?? []).length > 0;
}

async function avisarGestores(titulo: string, descricao: string) {
  try {
    const db = await createSistemaAdminClient();
    const { data: gestores } = await db.from("profiles").select("id").in("role", ["admin", "gerente"]).eq("ativo", true);
    await criarNotificacoes(
      (gestores ?? []).map((g) => ({
        userId: g.id as string,
        tipo: "seller",
        titulo,
        descricao,
        link: "/sistema/dropshipping/pedidos",
      }))
    );
  } catch (e) {
    console.error("[dropshipping-pedido-envio-automatico] avisarGestores:", e);
  }
}

/**
 * Chamado depois de carregar os pedidos de UM seller (`clienteId`) — recebe
 * os ids de fornecedor que têm pelo menos 1 pedido "pronto" agora e, pros
 * que estiverem com envio automático configurado e devido, monta o pacote
 * combinado de TODOS os pedidos "pronto" desse fornecedor+seller e manda.
 */
export async function processarEnvioAutomaticoPorFornecedor(clienteId: string, fornecedorIds: string[]): Promise<void> {
  const idsUnicos = [...new Set(fornecedorIds)];
  if (idsUnicos.length === 0 || !resendConfigurado()) return;

  try {
    const drop = await createDropshippingAdminClient();
    const sistema = await createSistemaAdminClient();
    // pro resumo de notificações conseguir agrupar por seller (ver notificacoes.ts).
    const { data: clienteRow } = await sistema.from("clientes").select("nome_fantasia").eq("id", clienteId).maybeSingle();
    const sellerNome = (clienteRow?.nome_fantasia as string | undefined) ?? "Seller";

    const { data } = await drop
      .from("fornecedores")
      .select("id, nome, email, envio_automatico_intervalo_min")
      .in("id", idsUnicos)
      .not("email", "is", null)
      .not("envio_automatico_intervalo_min", "is", null);

    for (const f of (data ?? []) as FornecedorEnvioAuto[]) {
      try {
        const devido = await reclamarEnvio(drop, f.id, f.envio_automatico_intervalo_min!);
        if (!devido) continue;

        const { data: pedidosProntos } = await drop
          .from("pedidos")
          .select("id, pedido_itens(produto:produtos(fornecedor_id))")
          .eq("cliente_id", clienteId)
          .eq("status", "pronto");
        const pedidoIds = (pedidosProntos ?? [])
          .filter((p) => {
            const itens = p.pedido_itens as unknown as { produto: { fornecedor_id: string | null } | null }[];
            return itens.length > 0 && itens.every((it) => it.produto?.fornecedor_id === f.id);
          })
          .map((p) => p.id as string);
        if (pedidoIds.length === 0) continue;

        const pacote = await gerarPacoteCombinado(clienteId, pedidoIds);
        if (!pacote.ok) {
          console.error(`[dropshipping-pedido-envio-automatico] gerarPacoteCombinado falhou para ${f.nome}:`, pacote.erro);
          continue;
        }

        await sendEmail({
          to: f.email!,
          subject: `Novos pedidos para enviar — ${pacote.incluidos.length} pedido(s)`,
          html: `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
            <p>Olá!</p>
            <p>Seguem ${pacote.incluidos.length} pedido(s) novo(s) liberado(s) para envio — etiquetas e planilha em anexo.</p>
            <p>Pedidos: ${pacote.incluidos.map((i) => `#${i.numero}`).join(", ")}</p>
          </div>`,
          attachments: [
            { filename: "etiquetas.pdf", content: pacote.etiquetas.toString("base64"), contentType: "application/pdf" },
            {
              filename: "pedidos.xlsx",
              content: pacote.planilha.toString("base64"),
              contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          ],
        });

        await marcarPedidosEnviados(
          clienteId,
          pacote.incluidos.map((i) => i.id)
        );

        await avisarGestores(
          `[${sellerNome}] Pacote enviado automaticamente para ${f.nome}`,
          `${pacote.incluidos.length} pedido(s) liberado(s) e enviado(s) por e-mail sozinho — pedidos ${pacote.incluidos
            .map((i) => `#${i.numero}`)
            .join(", ")}.`
        );
      } catch (e) {
        console.error(`[dropshipping-pedido-envio-automatico] falha no fornecedor ${f.id}:`, e);
      }
    }
  } catch (e) {
    console.error("[dropshipping-pedido-envio-automatico]:", e);
  }
}
