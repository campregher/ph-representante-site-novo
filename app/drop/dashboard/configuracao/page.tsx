import { requireSeller } from "@/lib/sistema/seller-auth";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { getMlRecords } from "@/lib/sistema/ml-auth";
import { metodosEnvioRealML } from "@/lib/sistema/dropshipping-ml-catalogo";
import AlterarSenhaForm from "@/components/drop/AlterarSenhaForm";
import FaturadorConfigCard from "@/components/drop/FaturadorConfigCard";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";
import Link from "next/link";

/** Métodos de envio que o Mercado Livre tem de fato ATIVOS agora em cada
 *  conta conectada — com o nome tal como o PRÓPRIO Mercado Livre usa (ver
 *  `metodosEnvioRealML`), não a categoria interna deste app (correios/
 *  mercado_envios/flex/entrega_direta, do questionário de onboarding). Só
 *  exibe — quem controla isso é o próprio painel do Mercado Livre. */
async function MetodosEnvioCard({ clienteId }: { clienteId: string }) {
  const contas = await getMlRecords(clienteId);

  if (contas.length === 0) {
    return (
      <Card>
        <CardHeader title="Métodos de envio" />
        <CardBody className="text-sm text-neutral-600">
          Nenhuma conta do Mercado Livre conectada ainda —{" "}
          <Link href="/drop/dashboard/integracao" className="font-medium text-brand underline">
            conecte uma em Integração
          </Link>
          .
        </CardBody>
      </Card>
    );
  }

  const resultados = await Promise.all(
    contas.map(async (c) => ({ conta: c, res: await metodosEnvioRealML(c.id) }))
  );

  return (
    <Card>
      <CardHeader title="Métodos de envio" />
      <CardBody className="space-y-3 text-sm">
        <p className="text-neutral-600">
          O que está ativo agora em cada conta conectada, direto do Mercado Livre. Para mudar, é no próprio painel do
          Mercado Livre (Configurações da conta → Envios).
        </p>
        {resultados.map(({ conta, res }) => (
          <div key={conta.id} className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-2">
            <span className="font-medium text-neutral-900">{conta.ml_nickname ?? "Conta ML"}</span>
            {!res.ok ? (
              <span className="text-xs text-neutral-500">Não foi possível consultar agora ({res.error})</span>
            ) : res.metodos.length === 0 ? (
              <span className="text-xs text-neutral-500">Nenhum método ativo encontrado.</span>
            ) : (
              res.metodos.map((m) => (
                <Badge key={`${m.mode}:${m.type}`} tone="blue">
                  {m.nome}
                </Badge>
              ))
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

export default async function DropDashboardConfiguracaoPage() {
  const seller = await requireSeller();
  const db = await createSistemaAdminClient();
  const { data } = await db.from("clientes").select("faturador_ml_ativo").eq("id", seller.id).maybeSingle();

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-bold text-neutral-900">Configuração</h1>
      <FaturadorConfigCard initial={!!data?.faturador_ml_ativo} />
      <MetodosEnvioCard clienteId={seller.id} />
      <AlterarSenhaForm />
    </div>
  );
}
