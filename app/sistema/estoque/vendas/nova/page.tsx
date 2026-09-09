import Link from "next/link";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { produtoProprioOptions, clientesParaDrop } from "@/lib/sistema/estoque";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import PedidoDropForm from "@/components/sistema/estoque/PedidoDropForm";

export default async function NovoPedidoDropPage() {
  const profile = await requireSistemaProfile();
  if (profile.role === "consulta") {
    return <EmptyState title="Sem permissão" description="Seu papel é somente leitura." />;
  }
  const [clientes, produtos] = await Promise.all([clientesParaDrop(), produtoProprioOptions()]);

  if (clientes.length === 0) {
    return (
      <div>
        <PageHeader title="Novo pedido drop" />
        <EmptyState
          title="Nenhum cliente cadastrado"
          description="Cadastre um cliente (marque 'Seller' se for revendedor da linha própria)."
          action={
            <Link href="/sistema/clientes/novo" className={buttonClass({ size: "sm" })}>
              Cadastrar cliente
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Novo pedido drop" description="Venda de produtos da linha própria." />
      <PedidoDropForm clientes={clientes} produtos={produtos} />
    </div>
  );
}
