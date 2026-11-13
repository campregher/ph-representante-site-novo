import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/sistema/ui/State";
import ImportarFornecedorForm from "@/components/sistema/dropshipping/ImportarFornecedorForm";

export default async function ImportarFornecedorPage() {
  const profile = await requireSistemaProfile();
  if (!canManage(profile.role)) redirect("/sistema/dropshipping/fornecedores");

  return (
    <div className="max-w-2xl">
      <Link href="/sistema/dropshipping/fornecedores" className="mb-3 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-brand">
        <ArrowLeft size={14} /> Voltar aos fornecedores
      </Link>
      <PageHeader title="Importar fornecedores" description="Importação em massa por CSV." />
      <ImportarFornecedorForm />
    </div>
  );
}
