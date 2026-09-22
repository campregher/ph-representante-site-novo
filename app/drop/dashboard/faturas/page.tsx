import { requireSeller } from "@/lib/sistema/seller-auth";
import { getFinanceiroSeller } from "@/lib/sistema/seller-financeiro";
import { formatBRL, formatDate } from "@/lib/sistema/format";
import SellerLocked from "@/components/drop/SellerLocked";
import { Card, CardHeader, CardBody, StatCard } from "@/components/sistema/ui/Card";

export default async function DropDashboardFaturasPage() {
  const seller = await requireSeller();

  if (!seller.liberado) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-neutral-900">Faturas/Histórico</h1>
        <SellerLocked seller={seller} />
      </div>
    );
  }

  const fin = await getFinanceiroSeller(seller.id);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-neutral-900">Faturas/Histórico</h1>
        <p className="text-sm text-neutral-500">
          Histórico de vendas via Mercado Livre, com comissão e frete exatos cobrados pelo ML.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Hoje" value={formatBRL(fin.hoje.valor)} hint={`${fin.hoje.quantidade} produto(s)`} />
        <StatCard label="Semana" value={formatBRL(fin.semana.valor)} hint={`${fin.semana.quantidade} produto(s)`} />
        <StatCard label="Mês" value={formatBRL(fin.mes.valor)} hint={`${fin.mes.quantidade} produto(s)`} />
      </div>

      <Card>
        <CardHeader title="Vendas recentes" description="Comissão e frete são os valores exatos que o Mercado Livre cobrou." />
        <CardBody className="space-y-1 text-sm">
          {fin.vendas.length === 0 ? (
            <p className="text-neutral-500">Nenhuma venda registrada ainda.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {fin.vendas.map((v) => (
                <div key={v.pedidoId} className="py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-medium text-neutral-900">
                      #{v.numero} — {v.produtos}
                    </p>
                    <p className={`shrink-0 font-semibold ${v.lucro >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatBRL(v.lucro)} ({v.lucroPercentual}%)
                    </p>
                  </div>
                  <p className="text-xs text-neutral-400">
                    {formatDate(v.data)} · {v.quantidade} un. · venda {formatBRL(v.venda)} · comissão ML{" "}
                    {formatBRL(v.comissaoMl)} · frete {formatBRL(v.frete)} · custo {formatBRL(v.custo)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
