import Link from "next/link";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { confirmarEmailSeller } from "@/lib/sistema/actions/seller-portal";
import { buttonClass } from "@/components/sistema/ui/buttonClass";

export default async function ConfirmarEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await confirmarEmailSeller(token);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <span className="text-2xl font-black tracking-tight text-neutral-900">PH</span>

        {!res.ok ? (
          <>
            <XCircle size={40} className="mx-auto mb-2 mt-4 text-red-500" />
            <h1 className="text-lg font-bold text-neutral-900">Link inválido</h1>
            <p className="mt-2 text-sm text-neutral-500">{res.error}</p>
          </>
        ) : res.jaConfirmado ? (
          <>
            <CheckCircle2 size={40} className="mx-auto mb-2 mt-4 text-green-600" />
            <h1 className="text-lg font-bold text-neutral-900">E-mail já confirmado</h1>
            <p className="mt-2 text-sm text-neutral-500">
              {res.aprovado
                ? "Seu cadastro já está ativo."
                : "Seu cadastro ainda está em análise pelo nosso time."}
            </p>
          </>
        ) : res.aprovado ? (
          <>
            <CheckCircle2 size={40} className="mx-auto mb-2 mt-4 text-green-600" />
            <h1 className="text-lg font-bold text-neutral-900">E-mail confirmado — cadastro aprovado!</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Olá, {res.nome}! Seu acesso já está liberado. Acesse seu portal pra ver o catálogo e
              conectar sua conta do Mercado Livre.
            </p>
          </>
        ) : (
          <>
            <Clock size={40} className="mx-auto mb-2 mt-4 text-yellow-600" />
            <h1 className="text-lg font-bold text-neutral-900">E-mail confirmado</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Seu documento ainda precisa ser revisado pelo nosso time antes de liberar o acesso.
              Avisamos assim que for aprovado.
            </p>
          </>
        )}

        {res.ok && (
          <Link href={`/drop/portal/${token}`} className={`${buttonClass({ size: "sm" })} mt-6`}>
            Ir para o portal
          </Link>
        )}
      </div>
    </div>
  );
}
