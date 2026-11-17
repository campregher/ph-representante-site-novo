import Link from "next/link";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { confirmarTrocaEmailSeller } from "@/lib/sistema/actions/seller-troca-email";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import AuthCard from "@/components/sistema/AuthCard";

export default async function ConfirmarTrocaEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await confirmarTrocaEmailSeller(token);

  const conteudo = !res.ok
    ? { icon: <XCircle size={36} className="text-red-500" />, titulo: "Link inválido", texto: res.error }
    : {
        icon: <CheckCircle2 size={36} className="text-green-600" />,
        titulo: `E-mail confirmado, ${res.nome}!`,
        texto: `A partir de agora, use ${res.novoEmail} pra fazer login.`,
      };

  return (
    <AuthCard title={conteudo.titulo} subtitle={conteudo.texto}>
      <div className="flex flex-col items-center gap-4">
        {conteudo.icon}
        {res.ok && (
          <Link href="/drop/login" className={`${buttonClass({ className: "w-full" })}`}>
            Ir para o login <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </AuthCard>
  );
}
