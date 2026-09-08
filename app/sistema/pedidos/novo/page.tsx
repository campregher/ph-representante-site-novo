import { requireSistemaProfile } from "@/lib/sistema/auth";
import { listClienteOptions, listRepresentadaOptions } from "@/lib/sistema/queries";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import NovoPedido from "@/components/sistema/pedidos/NovoPedido";

export default async function NovoPedidoPage() {
  const profile = await requireSistemaProfile();
  if (profile.role === "consulta") {
    return (
      <div>
        <PageHeader title="Novo pedido" />
        <EmptyState title="Sem permissão" description="Seu papel é somente leitura." />
      </div>
    );
  }

  const [clienteOptions, representadaOptions] = await Promise.all([
    listClienteOptions(),
    listRepresentadaOptions(),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Novo pedido"
        description="Cliente → representada → tabela → produtos → desconto."
      />
      {clienteOptions.length === 0 || representadaOptions.length === 0 ? (
        <EmptyState
          title="Cadastros incompletos"
          description="É preciso ter ao menos um cliente e uma representada ativa para lançar pedidos."
        />
      ) : (
        <NovoPedido clienteOptions={clienteOptions} representadaOptions={representadaOptions} />
      )}
    </div>
  );
}
