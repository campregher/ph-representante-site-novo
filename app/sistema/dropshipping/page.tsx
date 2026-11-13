import Link from "next/link";
import { Truck, Boxes, ArrowRight } from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { listDropFornecedores, listDropProdutos } from "@/lib/sistema/dropshipping";
import { PageHeader } from "@/components/sistema/ui/State";
import { StatCard } from "@/components/sistema/ui/Card";
import { buttonClass } from "@/components/sistema/ui/buttonClass";

export default async function DropshippingPage() {
  await requireSistemaProfile();
  const [fornecedores, produtos] = await Promise.all([listDropFornecedores(), listDropProdutos()]);

  return (
    <div>
      <PageHeader title="Dropshipping" description="Catálogo próprio, separado da representação — CPF compra da PH, CNPJ negocia direto com o fornecedor." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Fornecedores" value={String(fornecedores.length)} icon={<Truck size={16} />} />
        <StatCard label="Produtos" value={String(produtos.length)} icon={<Boxes size={16} />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/sistema/dropshipping/fornecedores" className="group flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5 hover:border-brand/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand"><Truck size={18} /></div>
            <div>
              <p className="font-semibold text-neutral-900">Fornecedores</p>
              <p className="text-sm text-neutral-500">Cadastro manual ou importação em CSV.</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-neutral-300 group-hover:text-brand" />
        </Link>

        <Link href="/sistema/dropshipping/produtos" className="group flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5 hover:border-brand/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand"><Boxes size={18} /></div>
            <div>
              <p className="font-semibold text-neutral-900">Produtos</p>
              <p className="text-sm text-neutral-500">Catálogo com preço de CPF e CNPJ por produto.</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-neutral-300 group-hover:text-brand" />
        </Link>
      </div>

      <div className="mt-6">
        <Link href="/sistema/dropshipping/fornecedores/importar" className={buttonClass({ variant: "outline", size: "sm" })}>
          Importar fornecedores/produtos por CSV
        </Link>
      </div>
    </div>
  );
}
