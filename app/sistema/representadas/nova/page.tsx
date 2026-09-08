import { requireRole } from "@/lib/sistema/auth";
import { PageHeader } from "@/components/sistema/ui/State";
import RepresentadaForm from "@/components/sistema/representadas/RepresentadaForm";

export default async function NovaRepresentadaPage() {
  await requireRole("admin", "gerente");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nova representada" />
      <RepresentadaForm />
    </div>
  );
}
