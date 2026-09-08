import Link from "next/link";
import {
  ShoppingCart,
  Users,
  TrendingUp,
  Wallet,
  Target,
  Percent,
  FileClock,
  Receipt,
  AlertTriangle,
  MoonStar,
} from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { listRepresentadaOptions, listVendedorOptions } from "@/lib/sistema/queries";
import { getDashboard } from "@/lib/sistema/dashboard";
import { formatBRL } from "@/lib/sistema/format";
import { PageHeader } from "@/components/sistema/ui/State";
import { StatCard, Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import DashboardFilters from "@/components/sistema/DashboardFilters";
import LineChart from "@/components/sistema/charts/LineChart";
import BarList from "@/components/sistema/charts/BarList";

const CARD_ICON: Record<string, React.ReactNode> = {
  "Vendas no mês": <TrendingUp size={16} />,
  "Pedidos no mês": <ShoppingCart size={16} />,
  "Clientes compradores": <Users size={16} />,
  "Ticket médio": <Receipt size={16} />,
  "Comissão prevista": <Wallet size={16} />,
  "Meta mensal": <Target size={16} />,
  "% da meta": <Percent size={16} />,
  "Aguardando faturamento": <FileClock size={16} />,
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Últimos 12 meses (YYYY-MM), do mais recente ao mais antigo. */
function mesesOptions(): { value: string; label: string }[] {
  const hoje = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: `${MESES[d.getMonth()]}/${d.getFullYear()}` });
  }
  return out;
}

function diasLabel(dias: number | null): string {
  if (dias == null) return "nunca comprou";
  return `há ${dias} dias`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireSistemaProfile();
  const gestor = canManage(profile.role);
  const primeiroNome = (profile.nome ?? profile.email ?? "").split(" ")[0];

  const sp = await searchParams;
  const meses = mesesOptions();
  const mes = sp.mes && meses.some((m) => m.value === sp.mes) ? sp.mes : meses[0].value;
  const representadaId = sp.representada || undefined;
  const vendedorId = gestor ? sp.vendedor || undefined : undefined;

  const [dash, representadas, vendedores] = await Promise.all([
    getDashboard({ mes, representadaId, vendedorId }),
    listRepresentadaOptions(),
    gestor ? listVendedorOptions() : Promise.resolve([]),
  ]);

  const mesLabel = meses.find((m) => m.value === mes)?.label ?? mes;

  return (
    <div>
      <PageHeader
        title={`Olá, ${primeiroNome}`}
        description={`Resumo comercial de ${mesLabel}.`}
      />

      <DashboardFilters
        meses={meses}
        representadas={representadas.map((r) => ({ value: r.id, label: r.label }))}
        vendedores={vendedores.map((v) => ({ value: v.id, label: v.label }))}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {dash.cards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            hint={c.hint}
            icon={CARD_ICON[c.label]}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Evolução de vendas"
            description="Últimos 12 meses · realizado x meta"
          />
          <CardBody>
            <LineChart
              points={dash.evolucao}
              meta={dash.evolucaoMeta.some((m) => m != null) ? dash.evolucaoMeta : undefined}
              format={formatBRL}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Vendas por representada"
            description={`No mês de ${mesLabel}`}
          />
          <CardBody>
            <BarList items={dash.vendasRepresentada} format={formatBRL} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Curva ABC — Clientes"
            description="Faturamento acumulado (12 meses)"
            action={
              <Link href="/sistema/clientes" className="text-xs font-medium text-brand hover:underline">
                Ver todos
              </Link>
            }
          />
          <CardBody>
            <BarList items={dash.abcClientes} format={formatBRL} empty="Nenhuma venda no período." />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Curva ABC — Produtos"
            description="Faturamento acumulado (12 meses)"
            action={
              <Link href="/sistema/produtos" className="text-xs font-medium text-brand hover:underline">
                Ver todos
              </Link>
            }
          />
          <CardBody>
            <BarList items={dash.abcProdutos} format={formatBRL} empty="Nenhuma venda no período." />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Clientes inativos"
            description="Sem comprar há mais de 30 dias"
            action={
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                <MoonStar size={12} /> {dash.inativos.count}
              </span>
            }
          />
          <CardBody className="p-0">
            {dash.inativos.itens.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-neutral-400">
                Nenhum cliente inativo. 🎉
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {dash.inativos.itens.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/sistema/clientes/${c.id}`}
                      className="flex items-center justify-between px-5 py-2.5 text-sm hover:bg-neutral-50"
                    >
                      <span className="min-w-0 truncate text-neutral-700">{c.nome}</span>
                      <span className="shrink-0 text-xs text-neutral-400">{diasLabel(c.dias)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Clientes A em risco"
            description="Classe A parados há mais de 45 dias"
            action={
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                <AlertTriangle size={12} /> {dash.aRisco.count}
              </span>
            }
          />
          <CardBody className="p-0">
            {dash.aRisco.itens.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-neutral-400">
                Nenhum cliente A em risco.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {dash.aRisco.itens.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/sistema/clientes/${c.id}`}
                      className="flex items-center justify-between px-5 py-2.5 text-sm hover:bg-neutral-50"
                    >
                      <span className="min-w-0 truncate text-neutral-700">{c.nome}</span>
                      <span className="shrink-0 text-xs text-amber-600">{diasLabel(c.dias)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
