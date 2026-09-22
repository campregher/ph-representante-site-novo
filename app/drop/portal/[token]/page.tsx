import Link from "next/link";
import { LineChart } from "lucide-react";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { getMlRecords } from "@/lib/sistema/ml-auth";
import { catalogoDropSeller } from "@/lib/sistema/seller-catalogo";
import SellerPortalMl from "@/components/public/SellerPortalMl";
import SellerCatalogoDrop from "@/components/public/SellerCatalogoDrop";
import AuthCard from "@/components/sistema/AuthCard";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { buttonClass } from "@/components/sistema/ui/buttonClass";

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

  const liberado = !pendente && !bloqueado && !!cliente.email_confirmado;
  const [mlContas, catalogo] = await Promise.all([
    liberado ? getMlRecords(cliente.id as string) : Promise.resolve([]),
    liberado ? catalogoDropSeller(cliente.id as string) : Promise.resolve([]),
  ]);
  const mlRecord = mlContas[0] ?? null;

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
          <Link href={`/drop/vendas/${token}`} className={buttonClass({ variant: "outline", className: "w-full" })}>
            <LineChart size={15} /> Ver minhas vendas
          </Link>
          <Card>
            <CardHeader
              title="Catálogo de dropshipping"
              description="Escolha o preço de venda (mínimo já calculado) e publique no seu Mercado Livre."
            />
            <CardBody>
              <SellerCatalogoDrop
                token={token}
                mlContas={mlContas.map((c) => ({ id: c.id, nickname: c.ml_nickname }))}
                itens={catalogo.map((p) => ({ ...p, precoMinimo: p.precoMinimo as number }))}
              />
            </CardBody>
          </Card>
        </div>
      )}
    </AuthCard>
  );
}
