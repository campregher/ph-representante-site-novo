import { requireSistemaProfile } from "@/lib/sistema/auth";
import { listVendedorOptions } from "@/lib/sistema/queries";
import { PageHeader } from "@/components/sistema/ui/State";
import ClienteForm from "@/components/sistema/clientes/ClienteForm";

export default async function NovoClientePage() {
  const profile = await requireSistemaProfile();
  const vendedorOptions = await listVendedorOptions();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo cliente" />
      <ClienteForm vendedorOptions={vendedorOptions} lockVendedor={profile.role === "vendedor"} />
    </div>
  );
}
