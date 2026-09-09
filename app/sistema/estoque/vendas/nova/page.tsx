import Link from "next/link";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { produtoProprioOptions, sellerOptions } from "@/lib/sistema/estoque";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import PedidoDropForm from "@/components/sistema/estoque/PedidoDropForm";

export default async function NovoPedidoDropPage() {
  const profile = await requireSistemaProfile();
  if (profile.role === "consulta") {
    return <EmptyState title="Sem permissão" description="Seu papel é somente leitura." />;
  }
  const [sellers, produtos] = await Promise.all([sellerOptions(), produtoProprioOptions()]);

  if (sellers.length === 0) {
    return (
      <div>
        <PageHeader title="Novo pedido drop" />
        <EmptyState
          title="Nenhum seller cadastrado"
          description="Cadastre um cliente e marque a opção 'Seller' para vender no dropshipping."
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
      <PageHeader title="Novo pedido drop" description="Venda de produtos da linha própria para um seller." />
      <PedidoDropForm sellers={sellers} produtos={produtos} />
    </div>
  );
}
