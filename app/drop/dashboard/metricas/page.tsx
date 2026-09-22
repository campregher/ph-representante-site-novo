import { requireSeller } from "@/lib/sistema/seller-auth";
import { getFinanceiroSeller } from "@/lib/sistema/seller-financeiro";
import { catalogoDropSeller } from "@/lib/sistema/seller-catalogo";
import { formatBRL } from "@/lib/sistema/format";
import SellerLocked from "@/components/drop/SellerLocked";
import { Card, CardHeader, CardBody, StatCard } from "@/components/sistema/ui/Card";

export default async function DropDashboardMetricasPage() {
  const seller = await requireSeller();

  if (!seller.liberado) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-neutral-900">Métricas</h1>
        <SellerLocked seller={seller} />
      </div>
    );
  }

  const [financeiro, catalogo] = await Promise.all([getFinanceiroSeller(seller.id), catalogoDropSeller(seller.id)]);
  const todosAnuncios = catalogo.flatMap((p) => p.anuncios);
  const ativos = todosAnuncios.filter((a) => a.status !== "paused").length;
  const pausados = todosAnuncios.length - ativos;

  const porProduto = new Map<string, { nome: string; quantidade: number; venda: number }>();
  for (const v of financeiro.vendas) {
    const atual = porProduto.get(v.produtos) ?? { nome: v.produtos, quantidade: 0, venda: 0 };
    atual.quantidade += v.quantidade;
    atual.venda += v.venda;
    porProduto.set(v.produtos, atual);
  }
  const ranking = [...porProduto.values()].sort((a, b) => b.venda - a.venda).slice(0, 10);

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-bold text-neutral-900">Métricas</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Vendas hoje" value={formatBRL(financeiro.hoje.valor)} hint={`${financeiro.hoje.quantidade} produto(s)`} />
        <StatCard label="Vendas na semana" value={formatBRL(financeiro.semana.valor)} hint={`${financeiro.semana.quantidade} produto(s)`} />
        <StatCard label="Vendas no mês" value={formatBRL(financeiro.mes.valor)} hint={`${financeiro.mes.quantidade} produto(s)`} />
        <StatCard label="Anúncios" value={`${ativos} ativos`} hint={pausados > 0 ? `${pausados} pausado(s)` : undefined} />
      </div>

      <Card>
        <CardHeader title="Produtos mais vendidos" description="Últimos 31 dias." />
        <CardBody>
          {ranking.length === 0 ? (
            <p className="text-sm text-neutral-600">Nenhuma venda registrada ainda.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {ranking.map((r) => (
                <div key={r.nome} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-neutral-900">{r.nome}</span>
                  <span className="shrink-0 text-neutral-500">{r.quantidade} un. · {formatBRL(r.venda)}</span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
