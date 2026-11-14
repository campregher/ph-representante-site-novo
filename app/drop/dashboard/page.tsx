import Link from "next/link";
import {
  Plug,
  PackageSearch,
  Megaphone,
  LineChart,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { getMlRecords } from "@/lib/sistema/ml-auth";
import { catalogoDropSeller } from "@/lib/sistema/seller-catalogo";
import { getFinanceiroSeller } from "@/lib/sistema/seller-financeiro";
import { formatBRL } from "@/lib/sistema/format";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Badge, CLIENTE_STATUS } from "@/components/sistema/ui/Badge";
import SellerLocked from "@/components/drop/SellerLocked";

const TONES = {
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  green: "bg-green-50 text-green-600",
  brand: "bg-brand/10 text-brand",
} as const;

function StatCardColor({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-neutral-500">{label}</p>
          <p className="truncate text-xl font-bold tracking-tight text-neutral-900">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

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

  const [mlContas, catalogo, financeiro] = await Promise.all([
    getMlRecords(seller.id),
    catalogoDropSeller(seller.id),
    getFinanceiroSeller(seller.id),
  ]);

  const anunciados = catalogo.filter((p) => p.anuncios.length > 0);
  const ativos = anunciados.filter((p) => p.anuncios.some((a) => a.status !== "paused"));

  const passos = [
    { label: "Conectar sua conta do Mercado Livre", done: mlContas.length > 0, href: "/drop/dashboard/integracao" },
    { label: "Ver produtos disponíveis pra anunciar", done: catalogo.length > 0, href: "/drop/dashboard/produtos" },
    { label: "Publicar seu primeiro anúncio", done: anunciados.length > 0, href: "/drop/dashboard/produtos" },
    { label: "Fazer sua primeira venda", done: financeiro.mes.quantidade > 0, href: "/drop/dashboard/faturas" },
  ];
  const concluidos = passos.filter((p) => p.done).length;
  const tudoPronto = concluidos === passos.length;

  return (
    <div className="space-y-4">
      {/* Banner de boas-vindas */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-gradient-to-br from-neutral-900 to-neutral-800 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Olá, {seller.nome}!</h1>
              <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-neutral-300">
              {tudoPronto
                ? "Sua loja está rodando — acompanhe os números abaixo."
                : "Falta pouco pra sua loja estar 100% rodando."}
            </p>
          </div>
          {!tudoPronto && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              {concluidos}/{passos.length} etapas concluídas
            </span>
          )}
        </div>
      </div>

      {/* Checklist de primeiros passos — some sozinho quando tudo estiver concluído */}
      {!tudoPronto && (
        <Card>
          <CardHeader title="Primeiros passos" description="Siga essa ordem pra começar a vender mais rápido." />
          <CardBody className="space-y-1">
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${(concluidos / passos.length) * 100}%` }}
              />
            </div>
            {passos.map((p) =>
              p.done ? (
                <div key={p.label} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-neutral-400">
                  <CheckCircle2 size={18} className="shrink-0 text-green-500" />
                  <span className="line-through">{p.label}</span>
                </div>
              ) : (
                <Link
                  key={p.label}
                  href={p.href}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <Circle size={18} className="shrink-0 text-neutral-300" />
                  <span className="flex-1 font-medium">{p.label}</span>
                  <ArrowRight size={15} className="text-neutral-400" />
                </Link>
              )
            )}
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCardColor
          label="Mercado Livre"
          value={mlContas.length > 0 ? `${mlContas.length} conta(s)` : "Não conectado"}
          hint={mlContas[0]?.ml_nickname ?? undefined}
          icon={<Plug size={18} />}
          tone="blue"
        />
        <StatCardColor label="Anúncios ativos" value={ativos.length} icon={<Megaphone size={18} />} tone="violet" />
        <StatCardColor
          label="Vendas do mês"
          value={formatBRL(financeiro.mes.valor)}
          hint={`${financeiro.mes.quantidade} produto(s)`}
          icon={<LineChart size={18} />}
          tone="green"
        />
        <StatCardColor
          label="Disponíveis pra anunciar"
          value={catalogo.filter((p) => p.anuncios.length === 0).length}
          icon={<PackageSearch size={18} />}
          tone="brand"
        />
      </div>
    </div>
  );
}
