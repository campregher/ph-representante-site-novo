import { requireSistemaProfile } from "@/lib/sistema/auth";
import { listMovimentos } from "@/lib/sistema/estoque";
import { formatDateTime } from "@/lib/sistema/format";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { Badge } from "@/components/sistema/ui/Badge";
import { TableScroll, Table, Thead, Tbody, Tr, Th, Td } from "@/components/sistema/ui/Table";

const TIPO: Record<string, { label: string; tone: "green" | "red" | "yellow" }> = {
  entrada: { label: "Entrada", tone: "green" },
  saida: { label: "Saída", tone: "red" },
  ajuste: { label: "Ajuste", tone: "yellow" },
};

export default async function MovimentosPage() {
  await requireSistemaProfile();
  const movs = await listMovimentos({ limit: 300 });
  return (
    <div>
      <PageHeader title="Movimentos de estoque" description="Extrato de entradas, saídas e ajustes." />
      {movs.length === 0 ? (
        <EmptyState title="Sem movimentos" description="Nenhuma entrada ou saída registrada ainda." />
      ) : (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>Data</Th>
                <Th>Produto</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Qtd</Th>
                <Th className="text-right">Saldo</Th>
                <Th>Origem</Th>
                <Th>Obs.</Th>
              </Tr>
            </Thead>
            <Tbody>
              {movs.map((m) => {
                const t = TIPO[m.tipo] ?? { label: m.tipo, tone: "yellow" as const };
                return (
                  <Tr key={m.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(m.created_at)}</Td>
                    <Td>
                      <span className="font-mono text-xs text-neutral-400">{m.sku}</span> {m.produto}
                    </Td>
                    <Td><Badge tone={t.tone}>{t.label}</Badge></Td>
                    <Td className={`text-right font-medium ${m.quantidade < 0 ? "text-red-600" : "text-green-700"}`}>
                      {m.quantidade > 0 ? "+" : ""}{m.quantidade}
                    </Td>
                    <Td className="text-right">{m.saldo_apos}</Td>
                    <Td className="text-xs text-neutral-500">{m.origem_tipo ?? "—"}</Td>
                    <Td className="text-xs text-neutral-500">{m.observacao ?? "—"}</Td>
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
