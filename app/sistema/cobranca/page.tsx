import { requireRole } from "@/lib/sistema/auth";
import { listContasReceber, cobrancaKpis } from "@/lib/sistema/cobranca";
import { listClienteOptions } from "@/lib/sistema/queries";
import { formatBRL } from "@/lib/sistema/format";
import { PageHeader } from "@/components/sistema/ui/State";
import { StatCard } from "@/components/sistema/ui/Card";
import SelectFilters from "@/components/sistema/SelectFilters";
import CobrancaView from "@/components/sistema/cobranca/CobrancaView";
import { CONTA_RECEBER_STATUS } from "@/lib/sistema/types";

export default async function CobrancaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole("admin", "gerente", "financeiro");
  const sp = await searchParams;
  const status = CONTA_RECEBER_STATUS.some((s) => s.value === sp.status) ? sp.status : undefined;
  const clienteId = sp.cliente || undefined;

  const [contas, kpis, clientes] = await Promise.all([
    listContasReceber({ status, clienteId }),
    cobrancaKpis(),
    listClienteOptions(),
  ]);

  return (
    <div>
      <PageHeader title="Cobrança" description="Contas a receber — pedidos drop e lançamentos avulsos." />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="A receber (em dia)" value={formatBRL(kpis.aberto)} />
        <StatCard label="Vencido" value={formatBRL(kpis.vencido)} hint={kpis.vencido > 0 ? "cobrar" : undefined} />
        <StatCard label="Recebido no mês" value={formatBRL(kpis.pagoMes)} />
        <StatCard label="Total em aberto" value={formatBRL(kpis.totalReceber)} />
      </div>

      <SelectFilters
        filters={[
          { key: "status", allLabel: "Todos os status", options: CONTA_RECEBER_STATUS.map((s) => ({ value: s.value, label: s.label })) },
          { key: "cliente", allLabel: "Todos os clientes", options: clientes.map((c) => ({ value: c.id, label: c.label })) },
        ]}
      />

      <CobrancaView contas={contas} clientes={clientes.map((c) => ({ id: c.id, label: c.label }))} />
    </div>
  );
}
