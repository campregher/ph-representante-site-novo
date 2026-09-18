import { createSistemaAdminClient } from "@/lib/supabase/server";
import { getMlRecord } from "@/lib/sistema/ml-auth";
import SellerPortalMl from "@/components/public/SellerPortalMl";
import AuthCard from "@/components/sistema/AuthCard";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";

export default async function SellerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await createSistemaAdminClient();
  const { data: cliente } = await db
    .from("clientes")
    .select("id, nome_fantasia, razao_social, status, email_confirmado")
    .eq("portal_token", token)
    .maybeSingle();

  if (!cliente) {
    return (
      <AuthCard title="Link inválido" subtitle="Este link de acesso não é válido. Fale com a gente se precisar de um novo.">
        {null}
      </AuthCard>
    );
  }

  const nome = (cliente.nome_fantasia as string) || (cliente.razao_social as string) || "seller";
  const status = cliente.status as string;
  const pendente = status === "prospect";
  const bloqueado = status === "bloqueado";

  const mlRecord = !pendente && !bloqueado ? await getMlRecord(cliente.id as string) : null;

  return (
    <AuthCard
      title={`Olá, ${nome}!`}
      subtitle="Portal do seller — dropshipping PH Representante."
      maxWidthClassName="max-w-2xl"
    >
      {bloqueado ? (
        <Card>
          <CardBody className="text-center text-sm text-neutral-600">
            Seu acesso está bloqueado no momento. Fale com nosso time para mais informações.
          </CardBody>
        </Card>
      ) : !cliente.email_confirmado ? (
        <Card>
          <CardHeader title="Confirme seu e-mail" />
          <CardBody className="text-sm text-neutral-600">
            Enviamos um link de confirmação pro e-mail que você cadastrou. Clique nele pra gente
            analisar seu documento e liberar o acesso.
          </CardBody>
        </Card>
      ) : pendente ? (
        <Card>
          <CardHeader title="Cadastro em análise" />
          <CardBody className="text-sm text-neutral-600">
            Seu e-mail foi confirmado e seu documento está em análise manual pelo nosso time. Assim
            que for aprovado, você poderá conectar sua conta do Mercado Livre e ver o catálogo de
            produtos disponíveis pra dropshipping aqui mesmo neste link — pode salvar essa página.
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          <SellerPortalMl
            token={token}
            conectado={!!mlRecord}
            nickname={mlRecord?.ml_nickname ?? null}
          />
          <Card>
            <CardHeader title="Catálogo de dropshipping" />
            <CardBody className="text-sm text-neutral-600">
              Em breve: aqui você vai poder escolher os produtos que quer anunciar no seu Mercado
              Livre e acompanhar suas vendas.
            </CardBody>
          </Card>
        </div>
      )}
    </AuthCard>
  );
}
