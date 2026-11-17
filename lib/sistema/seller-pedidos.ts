import { createDropshippingAdminClient, createSistemaAdminClient } from "@/lib/supabase/server";
import {
  processarPedidoAguardandoNF,
  precisaChecar,
  buscarMensagensPedido,
  type MensagemPedido,
} from "@/lib/sistema/dropshipping-pedido-arquivos";
import { atualizarEnvioEDevolucaoPedido, precisaChecarEnvio } from "@/lib/sistema/dropshipping-pedido-envio-status";

export interface PedidoDropItem {
  sku: string;
  nome: string;
  quantidade: number;
  caixas: number;
}

export interface PedidoDrop {
  id: string;
  numero: number;
  status: "aguardando_nf" | "pronto" | "enviado" | "cancelado";
  createdAt: string;
  itens: PedidoDropItem[];
  entregaCidade: string | null;
  entregaUf: string | null;
  /** null quando o pedido mistura itens de mais de um fornecedor (raro) —
   *  nesse caso ele não entra em nenhum grupo de envio combinado. */
  fornecedorId: string | null;
  fornecedorNome: string | null;
  /** Apelido da conta do Mercado Livre que gerou essa venda — um seller pode
   *  ter mais de uma conta conectada (ver getMlRecords). Null = conta sem
   *  apelido salvo (ver bug corrigido em ml-auth.ts) ou pedido sem conta. */
  contaNickname: string | null;
  /** Status REAL do Mercado Livre (envio físico/devolução) — diferente de
   *  `status` acima, que é só o repasse ao fornecedor. Ver
   *  dropshipping-pedido-envio-status.ts. */
  mlShippingStatus: string | null;
  mlShippingSubstatus: string | null;
  prazoEnvio: string | null;
  devolucaoStatus: string | null;
  devolucaoMotivo: string | null;
}

const PEDIDOS_COLS =
  "id, numero, status, canal, created_at, ml_conta_id, ml_shipping_id, pedido_externo, ultima_checagem_em, entrega_nome, entrega_telefone, entrega_cep, entrega_logradouro, entrega_numero, entrega_bairro, entrega_cidade, entrega_uf, ml_shipping_status, ml_shipping_substatus, ml_prazo_envio, ml_envio_atualizado_em, devolucao_status, devolucao_motivo, pedido_itens(quantidade, sku_snapshot, descricao_snapshot, unidades_por_kit, produto:produtos(fornecedor_id, fornecedor:fornecedores(nome)))";

/**
 * Pedidos de dropshipping do seller, mais recentes primeiro. Pra cada pedido
 * ainda "aguardando_nf" que não foi checado recentemente, consulta na hora
 * se a NF/etiqueta já ficaram prontas no Mercado Livre (ver
 * `processarPedidoAguardandoNF`) — é essa checagem, feita quando o seller
 * abre a página, que deixa o fluxo rápido pra ele sem depender só do cron
 * diário (Vercel Hobby não libera cron mais frequente que 1x/dia).
 */
export async function pedidosDropSeller(clienteId: string): Promise<PedidoDrop[]> {
  const db = await createDropshippingAdminClient();
  const { data } = await db
    .from("pedidos")
    .select(PEDIDOS_COLS)
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as {
    id: string;
    numero: number;
    status: PedidoDrop["status"];
    canal: string;
    created_at: string;
    ml_conta_id: string | null;
    ml_shipping_id: number | null;
    pedido_externo: string | null;
    ultima_checagem_em: string | null;
    entrega_nome: string | null;
    entrega_telefone: string | null;
    entrega_cep: string | null;
    entrega_logradouro: string | null;
    entrega_numero: string | null;
    entrega_bairro: string | null;
    entrega_cidade: string | null;
    entrega_uf: string | null;
    ml_shipping_status: string | null;
    ml_shipping_substatus: string | null;
    ml_prazo_envio: string | null;
    ml_envio_atualizado_em: string | null;
    devolucao_status: string | null;
    devolucao_motivo: string | null;
    pedido_itens: {
      quantidade: number;
      sku_snapshot: string | null;
      descricao_snapshot: string | null;
      unidades_por_kit: number;
      produto: { fornecedor_id: string | null; fornecedor: { nome: string } | null } | null;
    }[];
  }[];

  await Promise.all([
    ...rows
      .filter((p) => p.status === "aguardando_nf" && precisaChecar(p))
      .map(async (p) => {
        try {
          const res = await processarPedidoAguardandoNF(db, p);
          if (res.ficouPronto) p.status = "pronto";
        } catch (e) {
          console.error("[seller-pedidos] processarPedidoAguardandoNF:", e);
        }
      }),
    ...rows
      .filter((p) => p.status !== "cancelado" && precisaChecarEnvio(p))
      .map(async (p) => {
        try {
          const patch = await atualizarEnvioEDevolucaoPedido(db, p);
          Object.assign(p, patch);
        } catch (e) {
          console.error("[seller-pedidos] atualizarEnvioEDevolucaoPedido:", e);
        }
      }),
  ]);

  // `cliente_ml_tokens` (apelido da conta) mora no schema `comercial` — não
  // dá pra fazer embed cross-schema via PostgREST (mesmo padrão já usado em
  // seller-catalogo.ts pros anúncios).
  const contaIds = [...new Set(rows.map((p) => p.ml_conta_id).filter((v): v is string => !!v))];
  const nicknamePorConta = new Map<string, string | null>();
  if (contaIds.length) {
    const sistema = await createSistemaAdminClient();
    const { data: contas } = await sistema.from("cliente_ml_tokens").select("id, ml_nickname").in("id", contaIds);
    for (const c of contas ?? []) nicknamePorConta.set(c.id as string, c.ml_nickname as string | null);
  }

  return rows.map((p) => {
    const fornecedorIds = new Set(p.pedido_itens.map((it) => it.produto?.fornecedor_id).filter((v): v is string => !!v));
    const fornecedorId = fornecedorIds.size === 1 ? [...fornecedorIds][0] : null;
    const fornecedorNome = fornecedorId
      ? p.pedido_itens.find((it) => it.produto?.fornecedor_id === fornecedorId)?.produto?.fornecedor?.nome ?? null
      : null;
    return {
      id: p.id,
      numero: p.numero,
      status: p.status,
      createdAt: p.created_at,
      itens: p.pedido_itens.map((it) => ({
        sku: it.sku_snapshot ?? "—",
        nome: it.descricao_snapshot ?? "—",
        quantidade: it.quantidade,
        caixas: it.quantidade * (it.unidades_por_kit || 1),
      })),
      entregaCidade: p.entrega_cidade,
      entregaUf: p.entrega_uf,
      fornecedorId,
      fornecedorNome,
      contaNickname: p.ml_conta_id ? nicknamePorConta.get(p.ml_conta_id) ?? null : null,
      mlShippingStatus: p.ml_shipping_status,
      mlShippingSubstatus: p.ml_shipping_substatus,
      prazoEnvio: p.ml_prazo_envio,
      devolucaoStatus: p.devolucao_status,
      devolucaoMotivo: p.devolucao_motivo,
    };
  });
}

export interface PedidoDropDetalheItem extends PedidoDropItem {
  precoVenda: number;
  comissaoMl: number;
  custoUnitario: number;
}

export interface PedidoDropDetalhe {
  id: string;
  numero: number;
  status: PedidoDrop["status"];
  createdAt: string;
  canal: string;
  pedidoExterno: string | null;
  itens: PedidoDropDetalheItem[];
  valorTotal: number;
  frete: number | null;
  comissaoTotal: number;
  custoTotal: number;
  entrega: {
    nome: string | null;
    telefone: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
  };
  arquivos: { etiquetaPronta: boolean; danfePronta: boolean; planilhaPronta: boolean };
  mensagens: MensagemPedido[];
}

const PEDIDO_DETALHE_COLS =
  "id, numero, status, created_at, cliente_id, canal, pedido_externo, ml_conta_id, valor_total, ml_frete, entrega_nome, entrega_telefone, entrega_cep, entrega_logradouro, entrega_numero, entrega_complemento, entrega_bairro, entrega_cidade, entrega_uf, etiqueta_path, danfe_path, planilha_path, pedido_itens(quantidade, sku_snapshot, descricao_snapshot, unidades_por_kit, custo_unitario, ml_preco_venda, ml_comissao)";

/** Detalhe completo de UM pedido do seller — só o dono (`clienteId`) pode
 *  ver. Venda, recebimento estimado, entrega e mensagens do comprador. */
export async function getPedidoDropSeller(clienteId: string, id: string): Promise<PedidoDropDetalhe | null> {
  const db = await createDropshippingAdminClient();
  const { data } = await db.from("pedidos").select(PEDIDO_DETALHE_COLS).eq("id", id).maybeSingle();
  if (!data || data.cliente_id !== clienteId) return null;

  const r = data as unknown as {
    id: string;
    numero: number;
    status: PedidoDrop["status"];
    created_at: string;
    canal: string;
    pedido_externo: string | null;
    ml_conta_id: string | null;
    valor_total: number;
    ml_frete: number | null;
    entrega_nome: string | null;
    entrega_telefone: string | null;
    entrega_cep: string | null;
    entrega_logradouro: string | null;
    entrega_numero: string | null;
    entrega_complemento: string | null;
    entrega_bairro: string | null;
    entrega_cidade: string | null;
    entrega_uf: string | null;
    etiqueta_path: string | null;
    danfe_path: string | null;
    planilha_path: string | null;
    pedido_itens: {
      quantidade: number;
      sku_snapshot: string | null;
      descricao_snapshot: string | null;
      unidades_por_kit: number;
      custo_unitario: number;
      ml_preco_venda: number;
      ml_comissao: number;
    }[];
  };

  const mensagens =
    r.ml_conta_id && r.pedido_externo ? await buscarMensagensPedido(r.ml_conta_id, r.pedido_externo) : [];

  const itens = r.pedido_itens.map((it) => ({
    sku: it.sku_snapshot ?? "—",
    nome: it.descricao_snapshot ?? "—",
    quantidade: it.quantidade,
    caixas: it.quantidade * (it.unidades_por_kit || 1),
    precoVenda: Number(it.ml_preco_venda),
    comissaoMl: Number(it.ml_comissao),
    custoUnitario: Number(it.custo_unitario),
  }));

  return {
    id: r.id,
    numero: r.numero,
    status: r.status,
    createdAt: r.created_at,
    canal: r.canal,
    pedidoExterno: r.pedido_externo,
    itens,
    valorTotal: Number(r.valor_total),
    frete: r.ml_frete != null ? Number(r.ml_frete) : null,
    comissaoTotal: itens.reduce((s, it) => s + it.comissaoMl, 0),
    custoTotal: itens.reduce((s, it) => s + it.custoUnitario * it.quantidade, 0),
    entrega: {
      nome: r.entrega_nome,
      telefone: r.entrega_telefone,
      cep: r.entrega_cep,
      logradouro: r.entrega_logradouro,
      numero: r.entrega_numero,
      complemento: r.entrega_complemento,
      bairro: r.entrega_bairro,
      cidade: r.entrega_cidade,
      uf: r.entrega_uf,
    },
    arquivos: {
      etiquetaPronta: !!r.etiqueta_path,
      danfePronta: !!r.danfe_path,
      planilhaPronta: !!r.planilha_path,
    },
    mensagens,
  };
}
