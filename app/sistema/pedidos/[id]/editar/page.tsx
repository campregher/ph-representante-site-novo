import { notFound, redirect } from "next/navigation";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { listClienteOptions, listRepresentadaOptions } from "@/lib/sistema/queries";
import { nomeCurto } from "@/lib/sistema/pedido-doc";
import { PageHeader } from "@/components/sistema/ui/State";
import NovoPedido, { type PedidoInitial } from "@/components/sistema/pedidos/NovoPedido";
import type { Pedido, PedidoItem } from "@/lib/sistema/types";

export default async function EditarPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireSistemaProfile();
  if (profile.role === "consulta") redirect("/sistema/pedidos");

  const { id } = await params;
  const supabase = await createSistemaClient();

  const { data } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const p = data as Pedido;

  if (["faturado", "em_transporte", "entregue", "cancelado", "rejeitado"].includes(p.status)) {
    redirect(`/sistema/pedidos/${id}`);
  }

  const [{ data: itensRaw }, clienteOptions, representadaOptions] = await Promise.all([
    supabase.from("pedido_itens").select("*").eq("pedido_id", id).order("created_at"),
    listClienteOptions(),
    listRepresentadaOptions(),
  ]);

  const itens = ((itensRaw as PedidoItem[]) ?? [])
    .filter((it) => it.produto_id)
    .map((it) => ({
      produto_id: it.produto_id as string,
      variacao_id: it.variacao_id ?? null,
      sku: it.sku_snapshot ?? "",
      nome: nomeCurto(it.descricao_snapshot),
      quantidade: Number(it.quantidade),
      preco_tabela: Number(it.preco_tabela),
      desconto_item_percentual: Number(it.desconto_item_percentual),
      desconto_cascata:
        it.preco_liquido_manual != null
          ? []
          : Array.isArray(it.desconto_cascata) && it.desconto_cascata.length
            ? it.desconto_cascata.map(Number)
            : Number(it.desconto_item_percentual) > 0
              ? [Number(it.desconto_item_percentual)]
              : [],
      preco_liquido_manual:
        it.preco_liquido_manual != null ? Number(it.preco_liquido_manual) : null,
      tabela_preco_id: it.tabela_preco_id ?? null,
    }));

  const initial: PedidoInitial = {
    id: p.id,
    status: p.status,
    cliente_id: p.cliente_id,
    representada_id: p.representada_id,
    tabela_preco_id: p.tabela_preco_id,
    condicao_pagamento: p.condicao_pagamento,
    forma_pagamento: p.forma_pagamento,
    previsao_entrega: p.previsao_entrega,
    observacao_cliente: p.observacao_cliente,
    observacao_interna: p.observacao_interna,
    desconto_percentual: Number(p.desconto_percentual),
    desconto_cascata: Array.isArray(p.desconto_cascata) ? p.desconto_cascata.map(Number) : [],
    itens,
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title={`Editar pedido #${p.numero}`} description="Só pedidos em orçamento podem ser editados." />
      <NovoPedido
        initial={initial}
        clienteOptions={clienteOptions}
        representadaOptions={representadaOptions}
      />
    </div>
  );
}
