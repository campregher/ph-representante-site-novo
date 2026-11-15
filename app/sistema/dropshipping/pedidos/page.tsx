import { requireSistemaProfile } from "@/lib/sistema/auth";
import { listDropPedidos } from "@/lib/sistema/dropshipping";
import { formatBRL, formatDateTime } from "@/lib/sistema/format";
import { PageHeader } from "@/components/sistema/ui/State";
import { Badge } from "@/components/sistema/ui/Badge";
import { TableScroll, Table, Thead, Th, Tbody, Tr, Td } from "@/components/sistema/ui/Table";

const STATUS_LABEL = {
  aguardando_nf: { label: "Aguardando NF", tone: "yellow" as const },
  pronto: { label: "Pronto", tone: "green" as const },
  enviado: { label: "Enviado", tone: "blue" as const },
  cancelado: { label: "Cancelado", tone: "neutral" as const },
};

export default async function DropPedidosPage() {
  await requireSistemaProfile();
  const pedidos = await listDropPedidos();

  return (
    <div>
      <PageHeader
        title="Pedidos"
        description="Vendas de dropshipping no Mercado Livre, só acompanhamento — o seller resolve a etiqueta/NF com o fornecedor dele direto."
      />

      {pedidos.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum pedido registrado ainda.</p>
      ) : (
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
                <Th>Data</Th>
              </Tr>
            </Thead>
            <Tbody>
              {pedidos.map((p) => {
                const status = STATUS_LABEL[p.status];
                const totalCaixas = p.itens.reduce((s, it) => s + it.caixas, 0);
                return (
                  <Tr key={p.id}>
                    <Td className="font-semibold text-neutral-900">#{p.numero}</Td>
                    <Td>{p.sellerNome}</Td>
                    <Td>{p.itens.map((it) => `${it.quantidade}x ${it.nome}`).join(", ")}</Td>
                    <Td className="font-semibold text-neutral-900">{totalCaixas}</Td>
                    <Td>{p.entregaCidade ? `${p.entregaCidade}/${p.entregaUf ?? ""}` : "—"}</Td>
                    <Td>{formatBRL(p.valorTotal)}</Td>
                    <Td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-neutral-400">{formatDateTime(p.createdAt)}</Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableScroll>
      )}
    </div>
  );
}
