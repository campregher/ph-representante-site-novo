import Link from "next/link";
import { ChevronLeft, TrendingUp, Percent, RefreshCw, PackageX } from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { estoqueRelatorio } from "@/lib/sistema/estoque";
import { formatBRL, formatNumber, formatPercent } from "@/lib/sistema/format";
import { PageHeader } from "@/components/sistema/ui/State";
import { StatCard } from "@/components/sistema/ui/Card";
import SelectFilters from "@/components/sistema/SelectFilters";
import { TableScroll, Table, Thead, Tbody, Tr, Th, Td, TableEmpty } from "@/components/sistema/ui/Table";

const PERIODO_OPTIONS = [
  { value: "90", label: "Últimos 90 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "180", label: "Últimos 180 dias" },
];

export default async function EstoqueRelatorioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSistemaProfile();
  const sp = await searchParams;
  const dias = Number(sp.dias) || 90;

  const r = await estoqueRelatorio(dias);

  return (
    <div>
      <PageHeader
        title="Relatório — Linha Própria"
        description="Margem, giro de estoque e itens parados."
      />

      <Link
        href="/sistema/estoque"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-brand"
      >
        <ChevronLeft size={15} /> Linha Própria
      </Link>

      <SelectFilters filters={[{ key: "dias", options: PERIODO_OPTIONS }]} resettable={false} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={`Margem bruta (${r.dias}d)`}
          value={formatBRL(r.margem)}
          icon={<TrendingUp size={16} />}
          hint={`${formatPercent(r.margemPct)} da receita`}
        />
        <StatCard
          label={`Receita vendida (${r.dias}d)`}
          value={formatBRL(r.receita)}
          icon={<Percent size={16} />}
          hint={`${formatNumber(r.unidadesVendidas, 0)} unidades`}
        />
        <StatCard
          label="Giro de estoque (anualizado)"
          value={`${formatNumber(r.giroAnualizado, 1)}x`}
          icon={<RefreshCw size={16} />}
          hint="estimado pelo ritmo do período"
        />
        <StatCard
          label="Valor parado"
          value={formatBRL(r.valorParadoTotal)}
          icon={<PackageX size={16} />}
          hint={`${r.produtosParados.length} produto(s) sem venda no período`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">
            Produtos parados (sem venda no período)
          </h2>
          <TableScroll>
            <Table>
              <Thead>
                <Tr>
                  <Th>Produto</Th>
                  <Th className="text-right">Estoque</Th>
                  <Th className="text-right">Valor parado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {r.produtosParados.length === 0 ? (
                  <TableEmpty colSpan={3}>Nenhum produto parado — bom sinal.</TableEmpty>
                ) : (
                  r.produtosParados.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        <Link
                          href={`/sistema/estoque/produtos/${p.id}/editar`}
                          className="font-medium text-neutral-900 hover:text-brand"
                        >
                          {p.nome}
                        </Link>
                        <div className="font-mono text-[11px] text-neutral-400">{p.sku}</div>
                      </Td>
                      <Td className="text-right">{formatNumber(p.estoqueAtual, 0)}</Td>
                      <Td className="text-right font-medium">{formatBRL(p.valorParado)}</Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </TableScroll>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">
            Maior margem no período
          </h2>
          <TableScroll>
            <Table>
              <Thead>
                <Tr>
                  <Th>Produto</Th>
                  <Th className="text-right">Margem</Th>
                </Tr>
              </Thead>
              <Tbody>
                {r.topMargem.length === 0 ? (
                  <TableEmpty colSpan={2}>Nenhuma venda no período.</TableEmpty>
                ) : (
                  r.topMargem.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        <Link
                          href={`/sistema/estoque/produtos/${p.id}/editar`}
                          className="font-medium text-neutral-900 hover:text-brand"
                        >
                          {p.nome}
                        </Link>
                        <div className="font-mono text-[11px] text-neutral-400">{p.sku}</div>
                      </Td>
                      <Td className="text-right font-medium">{formatBRL(p.margem)}</Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </TableScroll>
        </div>
      </div>
    </div>
  );
}
