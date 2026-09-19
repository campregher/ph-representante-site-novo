import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { getFinanceiroSeller } from "@/lib/sistema/seller-financeiro";
import { formatBRL, formatDate } from "@/lib/sistema/format";
import AuthCard from "@/components/sistema/AuthCard";
import { Card, CardHeader, CardBody, StatCard } from "@/components/sistema/ui/Card";

export default async function SellerVendasPage({
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
  const liberado = cliente.status === "ativo" && !!cliente.email_confirmado;

  if (!liberado) {
    return (
      <AuthCard title={`Olá, ${nome}!`} subtitle="Suas vendas aparecem aqui assim que seu cadastro for liberado.">
        <Link href={`/drop/portal/${token}`} className="text-sm text-brand hover:underline">
          Voltar pro portal
        </Link>
      </AuthCard>
    );
  }

  const fin = await getFinanceiroSeller(cliente.id as string);

  return (
    <AuthCard title={`Vendas — ${nome}`} subtitle="Suas vendas no Mercado Livre." maxWidthClassName="max-w-3xl">
      <div className="space-y-4">
        <Link href={`/drop/portal/${token}`} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-brand">
          <ArrowLeft size={14} /> Voltar pro portal
        </Link>

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Hoje" value={formatBRL(fin.hoje.valor)} hint={`${fin.hoje.quantidade} produto(s)`} />
          <StatCard label="Semana" value={formatBRL(fin.semana.valor)} hint={`${fin.semana.quantidade} produto(s)`} />
          <StatCard label="Mês" value={formatBRL(fin.mes.valor)} hint={`${fin.mes.quantidade} produto(s)`} />
        </div>

        <Card>
          <CardHeader title="Vendas recentes" description="Comissão e frete são os valores exatos que o Mercado Livre cobrou." />
          <CardBody className="space-y-1 text-sm">
            {fin.vendas.length === 0 ? (
              <p className="text-neutral-500">Nenhuma venda registrada ainda.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {fin.vendas.map((v) => (
                  <div key={v.pedidoId} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-medium text-neutral-900">
                        #{v.numero} — {v.produtos}
                      </p>
                      <p className={`shrink-0 font-semibold ${v.lucro >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatBRL(v.lucro)} ({v.lucroPercentual}%)
                      </p>
                    </div>
                    <p className="text-xs text-neutral-400">
                      {formatDate(v.data)} · {v.quantidade} un. · venda {formatBRL(v.venda)} · comissão ML{" "}
                      {formatBRL(v.comissaoMl)} · frete {formatBRL(v.frete)} · custo {formatBRL(v.custo)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AuthCard>
  );
}
