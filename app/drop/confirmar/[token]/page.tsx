import Link from "next/link";
import { CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";
import { confirmarEmailSeller } from "@/lib/sistema/actions/seller-portal";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import AuthCard from "@/components/sistema/AuthCard";

export default async function ConfirmarEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await confirmarEmailSeller(token);

  const conteudo = !res.ok ? (
    { icon: <XCircle size={36} className="text-red-500" />, titulo: "Link inválido", texto: res.error }
  ) : res.jaConfirmado ? (
    {
      icon: <CheckCircle2 size={36} className="text-green-600" />,
      titulo: "E-mail já confirmado",
      texto: res.aprovado
        ? "Seu cadastro já está ativo."
        : "Seu cadastro ainda está em análise pelo nosso time.",
    }
  ) : res.aprovado ? (
    {
      icon: <CheckCircle2 size={36} className="text-green-600" />,
      titulo: `E-mail confirmado — cadastro aprovado, ${res.nome}!`,
      texto: "Seu acesso já está liberado. Acesse seu portal pra ver o catálogo e conectar sua conta do Mercado Livre.",
    }
  ) : (
    {
      icon: <Clock size={36} className="text-yellow-600" />,
      titulo: "E-mail confirmado",
      texto: "Seu documento ainda precisa ser revisado pelo nosso time antes de liberar o acesso. Avisamos assim que for aprovado.",
    }
  );

  return (
    <AuthCard title={conteudo.titulo} subtitle={conteudo.texto}>
      <div className="flex flex-col items-center gap-4">
        {conteudo.icon}
        {res.ok && (
          <Link href={`/drop/portal/${token}`} className={`${buttonClass({ className: "w-full" })}`}>
            Ir para o portal <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </AuthCard>
  );
}
