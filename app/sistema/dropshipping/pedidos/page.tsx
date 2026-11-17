import { requireSistemaProfile } from "@/lib/sistema/auth";
import { listDropPedidos, type DropPedidoAdmin } from "@/lib/sistema/dropshipping";
import { formatBRL, formatDateTime } from "@/lib/sistema/format";
import { classificarUrgenciaEnvio } from "@/lib/sistema/dropshipping-pedido-envio-status";
import { PageHeader } from "@/components/sistema/ui/State";
import { Badge } from "@/components/sistema/ui/Badge";
import RowLink from "@/components/sistema/RowLink";
import { TableScroll, Table, Thead, Th, Tbody, Tr, Td } from "@/components/sistema/ui/Table";
import PedidosTabs from "@/components/drop/PedidosTabs";
import AutoRefresh from "@/components/drop/AutoRefresh";

const STATUS_LABEL = {
  aguardando_nf: { label: "Aguardando NF", tone: "yellow" as const },
  pronto: { label: "Pronto", tone: "green" as const },
  enviado: { label: "Enviado", tone: "blue" as const },
  cancelado: { label: "Cancelado", tone: "neutral" as const },
};

/** Status REAL de envio do Mercado Livre — rótulos best-effort, formato
 *  nunca confirmado contra um envio de verdade (ver
 *  dropshipping-pedido-envio-status.ts). */
const ML_SHIPPING_LABEL: Record<string, { label: string; tone: "blue" | "green" | "red" | "neutral" }> = {
  pending: { label: "Aguardando despacho", tone: "neutral" },
  handling: { label: "Em preparação", tone: "neutral" },
  ready_to_ship: { label: "Pronto pra despachar", tone: "blue" },
  shipped: { label: "A caminho", tone: "blue" },
  delivered: { label: "Entregue", tone: "green" },
  not_delivered: { label: "Não entregue", tone: "red" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

export default async function DropPedidosPage() {
  await requireSistemaProfile();
  const pedidos = await listDropPedidos();

  // Mesmas 3 faixas de urgência do painel de vendas do próprio Mercado
  // Livre — "sem prazo informado" entra em "Próximos dias" (o campo de
  // prazo ainda não foi confirmado contra um envio real, ver aviso em
  // dropshipping-pedido-envio-status.ts).
  const aEnviar = pedidos.filter((p) => p.status === "aguardando_nf" || p.status === "pronto");
  const atrasados = aEnviar.filter((p) => classificarUrgenciaEnvio(p.prazoEnvio) === "atrasado");
  const hoje = aEnviar.filter((p) => classificarUrgenciaEnvio(p.prazoEnvio) === "hoje");
  const proximosDias = aEnviar.filter((p) => {
    const u = classificarUrgenciaEnvio(p.prazoEnvio);
    return u === "em_breve" || u === "sem_prazo";
  });
  const enviados = pedidos.filter((p) => p.status === "enviado");
  const devolucoes = pedidos.filter((p) => !!p.devolucaoStatus);

  return (
    <div>
      <AutoRefresh />
      <PageHeader
        title="Pedidos"
        description="Vendas de dropshipping no Mercado Livre com etiqueta já liberada — só acompanhamento, o seller resolve a etiqueta/NF com o fornecedor dele direto. Pedidos aguardando o seller declarar a NF no Mercado Livre não aparecem aqui."
      />

      <PedidosTabs
        tabs={[
          { id: "atrasados", label: "Atrasados", count: atrasados.length, content: <TabelaPedidos pedidos={atrasados} mostrarPrazo /> },
          { id: "hoje", label: "Hoje", count: hoje.length, content: <TabelaPedidos pedidos={hoje} mostrarPrazo /> },
          { id: "proximos_dias", label: "Próximos dias", count: proximosDias.length, content: <TabelaPedidos pedidos={proximosDias} mostrarPrazo /> },
          { id: "enviados", label: "Enviados", count: enviados.length, content: <TabelaPedidos pedidos={enviados} mostrarEnvioML /> },
          { id: "devolucoes", label: "Devoluções", count: devolucoes.length, content: <TabelaDevolucoes pedidos={devolucoes} /> },
        ]}
      />
    </div>
  );
}

function TabelaPedidos({
  pedidos,
  mostrarPrazo = false,
  mostrarEnvioML = false,
}: {
  pedidos: DropPedidoAdmin[];
  mostrarPrazo?: boolean;
  mostrarEnvioML?: boolean;
}) {
  if (pedidos.length === 0) return <p className="text-sm text-neutral-500">Nenhum pedido nessa situação.</p>;
  return (
    <div className="space-y-2">
      {mostrarPrazo && (
        <p className="text-xs text-neutral-400">
          Prazo estimado (venda + 24h de manuseio) — não é o horário exato de corte da agência do Mercado Livre.
        </p>
      )}
    <TableScroll>
      <Table>
        <Thead>
          <Tr>
            <Th>Nº</Th>
            <Th>Seller</Th>
            <Th>Itens</Th>
            <Th>Caixas a enviar</Th>
            <Th>Entrega</Th>
            <Th>Valor</Th>
            <Th>Status</Th>
            {mostrarPrazo && <Th>Prazo estimado</Th>}
            {mostrarEnvioML && <Th>Envio (ML)</Th>}
            <Th>Data</Th>
          </Tr>
        </Thead>
        <Tbody>
          {pedidos.map((p) => {
            const status = STATUS_LABEL[p.status];
            const envioMl = mostrarEnvioML && p.mlShippingStatus ? ML_SHIPPING_LABEL[p.mlShippingStatus] : null;
            const totalCaixas = p.itens.reduce((s, it) => s + it.caixas, 0);
            return (
              <RowLink key={p.id} href={`/sistema/dropshipping/pedidos/${p.id}`} className="hover:bg-neutral-50">
                <Td className="font-semibold text-neutral-900">#{p.numero}</Td>
                <Td>{p.sellerNome}</Td>
                <Td>{p.itens.map((it) => `${it.quantidade}x ${it.nome}`).join(", ")}</Td>
                <Td className="font-semibold text-neutral-900">{totalCaixas}</Td>
                <Td>{p.entregaCidade ? `${p.entregaCidade}/${p.entregaUf ?? ""}` : "—"}</Td>
                <Td>{formatBRL(p.valorTotal)}</Td>
                <Td>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </Td>
                {mostrarPrazo && <Td className="whitespace-nowrap text-neutral-400">{p.prazoEnvio ? formatDateTime(p.prazoEnvio) : "—"}</Td>}
                {mostrarEnvioML && (
                  <Td>{envioMl ? <Badge tone={envioMl.tone}>{envioMl.label}</Badge> : "—"}</Td>
                )}
                <Td className="whitespace-nowrap text-neutral-400">{formatDateTime(p.createdAt)}</Td>
              </RowLink>
            );
          })}
        </Tbody>
      </Table>
      </TableScroll>
    </div>
  );
}

function TabelaDevolucoes({ pedidos }: { pedidos: DropPedidoAdmin[] }) {
  if (pedidos.length === 0) return <p className="text-sm text-neutral-500">Nenhuma devolução em andamento.</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400">
        Configuração de garantias e motivos de devolução chega em breve — por enquanto é só acompanhamento.
      </p>
      <TableScroll>
        <Table>
          <Thead>
            <Tr>
              <Th>Nº</Th>
              <Th>Seller</Th>
              <Th>Motivo</Th>
              <Th>Status da devolução</Th>
              <Th>Data</Th>
            </Tr>
          </Thead>
          <Tbody>
            {pedidos.map((p) => (
              <RowLink key={p.id} href={`/sistema/dropshipping/pedidos/${p.id}`} className="hover:bg-neutral-50">
                <Td className="font-semibold text-neutral-900">#{p.numero}</Td>
                <Td>{p.sellerNome}</Td>
                <Td>{p.devolucaoMotivo ?? "—"}</Td>
                <Td>
                  <Badge tone="red">{p.devolucaoStatus}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-neutral-400">{formatDateTime(p.createdAt)}</Td>
              </RowLink>
            ))}
          </Tbody>
        </Table>
      </TableScroll>
    </div>
  );
}
