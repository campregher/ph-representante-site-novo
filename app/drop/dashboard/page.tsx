import Link from "next/link";
import { Plug, PackageSearch, Megaphone, LineChart } from "lucide-react";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { getMlRecord } from "@/lib/sistema/ml-auth";
import { catalogoDropSeller } from "@/lib/sistema/seller-catalogo";
import { getFinanceiroSeller } from "@/lib/sistema/seller-financeiro";
import { formatBRL } from "@/lib/sistema/format";
import { Card, CardHeader, CardBody, StatCard } from "@/components/sistema/ui/Card";
import { Badge, CLIENTE_STATUS } from "@/components/sistema/ui/Badge";
import SellerLocked from "@/components/drop/SellerLocked";

export default async function DropDashboardInicioPage() {
  const seller = await requireSeller();
  const statusInfo = CLIENTE_STATUS[seller.status] ?? { label: seller.status, tone: "neutral" as const };

  if (!seller.liberado) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-neutral-900">Olá, {seller.nome}!</h1>
        <SellerLocked seller={seller} />
      </div>
    );
  }

  const [mlRecord, catalogo, financeiro] = await Promise.all([
    getMlRecord(seller.id),
    catalogoDropSeller(seller.id),
    getFinanceiroSeller(seller.id),
  ]);

  const anunciados = catalogo.filter((p) => p.anuncio);
  const ativos = anunciados.filter((p) => p.anuncio?.status !== "paused");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold text-neutral-900">Olá, {seller.nome}!</h1>
        <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
      </div>

      {!mlRecord && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardBody className="flex items-center justify-between gap-3 text-sm text-yellow-800">
            <span>Conecte sua conta do Mercado Livre pra começar a anunciar.</span>
            <Link href="/drop/dashboard/integracao" className="font-semibold text-brand hover:underline">
              Conectar agora →
            </Link>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Mercado Livre"
          value={mlRecord ? "Conectado" : "Não conectado"}
          hint={mlRecord?.ml_nickname ?? undefined}
          icon={<Plug size={16} />}
        />
        <StatCard label="Anúncios ativos" value={ativos.length} icon={<Megaphone size={16} />} />
        <StatCard
          label="Vendas do mês"
          value={formatBRL(financeiro.mes.valor)}
          hint={`${financeiro.mes.quantidade} produto(s)`}
          icon={<LineChart size={16} />}
        />
        <StatCard
          label="Disponíveis pra anunciar"
          value={catalogo.filter((p) => !p.anuncio).length}
          icon={<PackageSearch size={16} />}
        />
      </div>

      <Card>
        <CardHeader title="Próximos passos" />
        <CardBody className="space-y-2 text-sm">
          <Link href="/drop/dashboard/produtos" className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-neutral-50">
            <span>Ver produtos disponíveis pra anunciar</span>
            <span className="text-neutral-400">→</span>
          </Link>
          <Link href="/drop/dashboard/anunciados" className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-neutral-50">
            <span>Gerenciar anúncios publicados</span>
            <span className="text-neutral-400">→</span>
          </Link>
          <Link href="/drop/dashboard/faturas" className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-neutral-50">
            <span>Ver histórico de vendas</span>
            <span className="text-neutral-400">→</span>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
