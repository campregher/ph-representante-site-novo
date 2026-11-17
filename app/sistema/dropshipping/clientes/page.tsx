import Link from "next/link";
import { Users, Megaphone, ShoppingCart, Store, ChevronRight } from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { listDropClientes } from "@/lib/sistema/dropshipping";
import { PageHeader } from "@/components/sistema/ui/State";
import { StatCard } from "@/components/sistema/ui/Card";
import { Badge, CLIENTE_STATUS } from "@/components/sistema/ui/Badge";
import { TableScroll, Table, Thead, Tbody, Tr, Th, Td, TableEmpty } from "@/components/sistema/ui/Table";
import { formatBRL, formatDate } from "@/lib/sistema/format";

export default async function DropClientesPage() {
  await requireSistemaProfile();
  const clientes = await listDropClientes();

  const totalAnuncios = clientes.reduce((s, c) => s + c.totalAnuncios, 0);
  const totalVendas = clientes.reduce((s, c) => s + c.totalVendas, 0);
  const valorTotal = clientes.reduce((s, c) => s + c.valorTotalVendido, 0);

  return (
    <div>
      <PageHeader title="Clientes do Drop" description="Sellers de dropshipping — anúncios publicados e vendas por cliente." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sellers" value={String(clientes.length)} icon={<Users size={16} />} />
        <StatCard label="Anúncios publicados" value={String(totalAnuncios)} icon={<Megaphone size={16} />} />
        <StatCard label="Vendas" value={String(totalVendas)} icon={<ShoppingCart size={16} />} />
        <StatCard label="Valor vendido" value={formatBRL(valorTotal)} icon={<Store size={16} />} />
      </div>

      <TableScroll>
        <Table>
          <Thead>
            <Tr>
              <Th>Seller</Th>
              <Th>Status</Th>
              <Th className="text-center">Contas ML</Th>
              <Th className="text-center">Anúncios</Th>
              <Th className="text-center">Vendas</Th>
              <Th className="text-right">Valor vendido</Th>
              <Th>Cliente desde</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {clientes.length === 0 ? (
              <TableEmpty colSpan={8}>Nenhum seller de dropshipping cadastrado ainda.</TableEmpty>
            ) : (
              clientes.map((c) => {
                const statusInfo = CLIENTE_STATUS[c.status] ?? { label: c.status, tone: "neutral" as const };
                return (
                  <Tr key={c.id}>
                    <Td className="font-medium text-neutral-900">
                      <Link href={`/sistema/dropshipping/clientes/${c.id}`} className="hover:text-brand hover:underline">
                        {c.nomeFantasia || c.email || "Sem nome"}
                      </Link>
                      {c.email && <div className="text-xs font-normal text-neutral-400">{c.email}</div>}
                    </Td>
                    <Td>
                      <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
                    </Td>
                    <Td className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <Store size={13} className="text-neutral-400" /> {c.contasMl}
                      </span>
                    </Td>
                    <Td className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <Megaphone size={13} className="text-neutral-400" /> {c.totalAnuncios}
                      </span>
                    </Td>
                    <Td className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <ShoppingCart size={13} className="text-neutral-400" /> {c.totalVendas}
                      </span>
                    </Td>
                    <Td className="text-right font-medium text-neutral-900">{formatBRL(c.valorTotalVendido)}</Td>
                    <Td className="text-neutral-400">{formatDate(c.createdAt)}</Td>
                    <Td className="text-right">
                      <Link href={`/sistema/dropshipping/clientes/${c.id}`}>
                        <ChevronRight size={16} className="text-neutral-300" />
                      </Link>
                    </Td>
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </TableScroll>
    </div>
  );
}
