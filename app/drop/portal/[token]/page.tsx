import { createSistemaAdminClient } from "@/lib/supabase/server";
import { getMlRecord } from "@/lib/sistema/ml-auth";
import SellerPortalMl from "@/components/public/SellerPortalMl";
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
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <span className="text-2xl font-black tracking-tight text-neutral-900">PH</span>
          <h1 className="mt-4 text-lg font-bold text-neutral-900">Link inválido</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Este link de acesso não é válido. Fale com a gente se precisar de um novo.
          </p>
        </div>
      </div>
    );
  }

  const nome = (cliente.nome_fantasia as string) || (cliente.razao_social as string) || "seller";
  const status = cliente.status as string;
  const pendente = status === "prospect";
  const bloqueado = status === "bloqueado";

  const mlRecord = !pendente && !bloqueado ? await getMlRecord(cliente.id as string) : null;

  return (
    <div className="mx-auto max-w-2xl p-4 py-10 sm:py-16">
      <div className="mb-6 text-center">
        <span className="text-2xl font-black tracking-tight text-neutral-900">PH</span>
        <h1 className="mt-3 text-xl font-bold text-neutral-900">Olá, {nome}!</h1>
        <p className="mt-1 text-sm text-neutral-500">Portal do seller — dropshipping PH Representante.</p>
      </div>

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
    </div>
  );
}
