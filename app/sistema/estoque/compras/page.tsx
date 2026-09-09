import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { listCompras } from "@/lib/sistema/estoque";
import { formatBRL, formatDate } from "@/lib/sistema/format";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { Badge } from "@/components/sistema/ui/Badge";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import CancelarCompraButton from "@/components/sistema/estoque/CancelarCompraButton";
import { TableScroll, Table, Thead, Tbody, Tr, Th, Td } from "@/components/sistema/ui/Table";

export default async function ComprasPage() {
  const profile = await requireSistemaProfile();
  const gestor = canManage(profile.role);
  const compras = await listCompras();

  return (
    <div>
      <PageHeader
        title="Compras"
        description="Entradas de estoque da linha própria."
        action={
          gestor && (
            <Link href="/sistema/estoque/compras/nova" className={buttonClass({ size: "sm" })}>
              <Plus size={15} /> Nova compra
            </Link>
          )
        }
      />
      {compras.length === 0 ? (
        <EmptyState title="Nenhuma compra" description="Registre uma compra para dar entrada no estoque." />
      ) : (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>Data</Th>
                <Th>NF</Th>
                <Th>Fornecedor</Th>
                <Th className="text-right">Itens</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
                {gestor && <Th className="text-right">Ações</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {compras.map((c) => (
                <Tr key={c.id}>
                  <Td>{formatDate(c.data_compra)}</Td>
                  <Td>{c.numero_nota ?? "—"}</Td>
                  <Td>{c.fornecedor ?? "—"}</Td>
                  <Td className="text-right">{c.itens}</Td>
                  <Td className="text-right font-medium">{formatBRL(c.valor_total)}</Td>
                  <Td>
                    <Badge tone={c.status === "cancelada" ? "neutral" : "green"}>
                      {c.status === "cancelada" ? "Cancelada" : "Recebida"}
                    </Badge>
                  </Td>
                  {gestor && (
                    <Td className="text-right">
                      {c.status !== "cancelada" && <CancelarCompraButton id={c.id} />}
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableScroll>
      )}
    </div>
  );
}
