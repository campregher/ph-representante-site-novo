import Link from "next/link";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { listFilaDespacho } from "@/lib/sistema/estoque";
import { formatDate } from "@/lib/sistema/format";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { Badge, PEDIDO_STATUS } from "@/components/sistema/ui/Badge";
import { TableScroll, Table, Thead, Tbody, Tr, Th, Td, TableEmpty } from "@/components/sistema/ui/Table";
import { Boxes } from "lucide-react";
import DespachoRowActions from "@/components/sistema/estoque/DespachoRowActions";

export default async function DespachoPage() {
  await requireSistemaProfile();
  const rows = await listFilaDespacho();

  return (
    <div>
      <PageHeader
        title="Fila de despacho"
        description="Pedidos drop confirmados/faturados ainda não postados — inclui vendas automáticas do Mercado Livre."
      />

      {rows.length === 0 ? (
        <EmptyState icon={<Boxes size={32} />} title="Nada pendente" description="Todos os pedidos drop já foram postados." />
      ) : (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>Nº</Th>
                <Th>Data</Th>
                <Th>Seller</Th>
                <Th>Produtos</Th>
                <Th>Entrega</Th>
                <Th>Canal</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.length === 0 ? (
                <TableEmpty colSpan={8}>Nada aqui.</TableEmpty>
              ) : (
                rows.map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-mono text-xs">
                      <Link href={`/sistema/pedidos/${r.id}`} className="text-brand hover:underline">
                        #{r.numero}
                      </Link>
                    </Td>
                    <Td>{formatDate(r.dataPedido)}</Td>
                    <Td>{r.seller}</Td>
                    <Td className="max-w-xs truncate" title={r.produtos}>{r.produtos}</Td>
                    <Td>{r.entrega ?? "—"}</Td>
                    <Td>{r.canal ?? "—"}</Td>
                    <Td>
                      <Badge tone={PEDIDO_STATUS[r.status]?.tone ?? "neutral"}>
                        {PEDIDO_STATUS[r.status]?.label ?? r.status}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <DespachoRowActions pedidoId={r.id} />
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </TableScroll>
      )}
    </div>
  );
}
