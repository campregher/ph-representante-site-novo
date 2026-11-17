import { AlertTriangle, CheckCircle2, MessageSquareWarning } from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { listRelatosProblema } from "@/lib/sistema/dropshipping";
import { PageHeader } from "@/components/sistema/ui/State";
import { StatCard } from "@/components/sistema/ui/Card";
import RelatosView from "@/components/sistema/dropshipping/RelatosView";

export default async function DropRelatosPage() {
  await requireSistemaProfile();
  const relatos = await listRelatosProblema();
  const abertos = relatos.filter((r) => r.status === "aberto");
  const resolvidos = relatos.filter((r) => r.status !== "aberto");

  return (
    <div className="max-w-3xl">
      <PageHeader title="Relatos de problema" description="Problemas reportados por sellers direto do portal." />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Total" value={String(relatos.length)} icon={<MessageSquareWarning size={16} />} />
        <StatCard label="Abertos" value={String(abertos.length)} icon={<AlertTriangle size={16} />} />
        <StatCard label="Resolvidos" value={String(resolvidos.length)} icon={<CheckCircle2 size={16} />} />
      </div>

      <RelatosView relatos={relatos} />
    </div>
  );
}
