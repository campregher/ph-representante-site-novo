"use client";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ShoppingBag, Unlink, Plus, CalendarDays, TrendingUp, Truck, ShieldCheck } from "lucide-react";
import { desconectarMlConta } from "@/lib/sistema/actions/seller-portal";
import { Button } from "@/components/sistema/ui/Button";
import type { MetricasContaML } from "@/lib/sistema/dropshipping-ml-catalogo";

export interface MlContaItem {
  id: string;
  nickname: string | null;
  metricas: MetricasContaML | null;
  tiposEnvio: string[];
}

/** Mesma escala de cor que o próprio Mercado Livre usa pro "termômetro" de
 *  reputação (vermelho → laranja → amarelo → verde-claro → verde) — reaproveita
 *  o reconhecimento que o seller já tem da tela dele no ML, em vez de inventar
 *  uma escala nova. `level_id` vem nulo pra conta sem reputação formada ainda. */
const REPUTACAO: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  "5_green": { label: "Excelente", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  "4_light_green": { label: "Boa", dot: "bg-lime-500", text: "text-lime-700", bg: "bg-lime-50" },
  "3_yellow": { label: "Regular", dot: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-50" },
  "2_orange": { label: "Em construção", dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50" },
  "1_red": { label: "Baixa", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50" },
};

const MERCADO_LIDER: Record<string, string> = {
  platinum: "MercadoLíder Platinum",
  gold: "MercadoLíder Gold",
  silver: "MercadoLíder",
};

function tempoDeConta(iso: string | null): string {
  if (!iso) return "—";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias < 0) return "—";
  const anos = Math.floor(dias / 365);
  if (anos >= 1) return `${anos} ano${anos > 1 ? "s" : ""}`;
  const meses = Math.floor(dias / 30);
  if (meses >= 1) return `${meses} ${meses > 1 ? "meses" : "mês"}`;
  if (dias === 0) return "Hoje";
  return `${dias}d`;
}

function ReputacaoPill({ metricas }: { metricas: MetricasContaML | null }) {
  const lider = metricas?.powerSellerStatus ? MERCADO_LIDER[metricas.powerSellerStatus] : null;
  const nivel = metricas?.reputacaoLevelId ? REPUTACAO[metricas.reputacaoLevelId] : null;

  if (!nivel) {
    return <span className="text-sm font-semibold text-neutral-400">Conta nova</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${nivel.bg} ${nivel.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${nivel.dot}`} /> {nivel.label}
      </span>
      {lider && (
        <span className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-amber-600">
          <ShieldCheck size={11} /> {lider}
        </span>
      )}
    </div>
  );
}

function StatCell({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
        {icon} {label}
      </div>
      <div className="mt-1.5 font-mono text-sm font-semibold tabular-nums text-neutral-900">{children}</div>
    </div>
  );
}

export default function DropMlContas({ token, contas }: { token: string; contas: MlContaItem[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  useEffect(() => {
    const ml = sp.get("ml");
    if (ml === "conectado") toast.success("Conta do Mercado Livre conectada!");
    if (ml === "erro") toast.error(sp.get("detalhe") || "Falha ao conectar o Mercado Livre.");
    if (ml) router.replace("/drop/dashboard/integracao");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function desconectar(contaId: string) {
    start(async () => {
      const res = await desconectarMlConta(token, contaId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Conta do Mercado Livre desconectada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {contas.map((c) => (
        <div key={c.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-50 text-yellow-600">
                <ShoppingBag size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{c.nickname ?? "Conta ML"}</p>
                <p className="text-xs text-neutral-500">Conectado</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => desconectar(c.id)} loading={pending}>
              <Unlink size={14} /> Desconectar
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-px border-t border-neutral-100 bg-neutral-100">
            <StatCell icon={<CalendarDays size={11} />} label="Conta desde">
              {tempoDeConta(c.metricas?.contaDesde ?? null)}
            </StatCell>
            <StatCell icon={<TrendingUp size={11} />} label="Vendas">
              {c.metricas?.vendasCompletas != null ? c.metricas.vendasCompletas.toLocaleString("pt-BR") : "—"}
            </StatCell>
            <StatCell icon={<ShieldCheck size={11} />} label="Reputação">
              <ReputacaoPill metricas={c.metricas} />
            </StatCell>
          </div>

          {c.tiposEnvio.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-100 bg-white p-3">
              <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                <Truck size={11} /> Envio
              </span>
              {c.tiposEnvio.map((t) => (
                <span key={t} className="rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      <a href={`/api/drop/ml/connect?token=${token}`} className="block">
        <Button variant="outline" size="sm" type="button" className="w-full">
          <Plus size={14} /> {contas.length > 0 ? "Conectar outra conta" : "Conectar conta do Mercado Livre"}
        </Button>
      </a>
      {contas.length > 0 && (
        <p className="text-xs text-neutral-400">
          Para conectar outra conta, saia da conta atual no mercadolivre.com.br antes de clicar (ou use uma aba anônima) — senão o ML autoriza de novo a mesma conta.
        </p>
      )}
    </div>
  );
}
