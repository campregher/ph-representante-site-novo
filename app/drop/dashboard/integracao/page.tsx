import { requireSeller } from "@/lib/sistema/seller-auth";
import { getMlRecords } from "@/lib/sistema/ml-auth";
import { metricasContaML, metodosEnvioRealML } from "@/lib/sistema/dropshipping-ml-catalogo";
import DropMlContas, { type MlContaItem } from "@/components/drop/DropMlContas";
import SellerLocked from "@/components/drop/SellerLocked";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";

export default async function DropDashboardIntegracaoPage() {
  const seller = await requireSeller();

  if (!seller.liberado) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-neutral-900">Integração</h1>
        <SellerLocked seller={seller} />
      </div>
    );
  }

  const mlContasRaw = await getMlRecords(seller.id);
  const mlContas: MlContaItem[] = await Promise.all(
    mlContasRaw.map(async (c) => {
      const [metricas, envio] = await Promise.all([metricasContaML(c.id), metodosEnvioRealML(c.id)]);
      return {
        id: c.id,
        nickname: c.ml_nickname,
        metricas: metricas.ok ? metricas.metricas : null,
        tiposEnvio: envio.ok ? envio.metodos.map((m) => m.nome) : [],
      };
    })
  );

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-bold text-neutral-900">Integração</h1>
      <DropMlContas token={seller.portalToken} contas={mlContas} />
      <Card>
        <CardHeader title="Como funciona" />
        <CardBody className="space-y-2 text-sm text-neutral-600">
          <p>Conectar pelo menos uma conta do Mercado Livre é obrigatório antes de anunciar qualquer produto.</p>
          <p>Você pode conectar mais de uma conta e escolher, produto por produto, em qual delas anunciar — o mesmo produto pode estar em mais de uma conta ao mesmo tempo.</p>
          <p>Depois de conectado, vá em &quot;Produtos para Anunciar&quot; para escolher o que vender.</p>
        </CardBody>
      </Card>
    </div>
  );
}
