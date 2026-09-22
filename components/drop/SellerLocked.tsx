import Link from "next/link";
import { Clock, XCircle, MailWarning } from "lucide-react";
import { Card, CardBody } from "@/components/sistema/ui/Card";
import type { SellerProfile } from "@/lib/sistema/seller-auth";

/** Card explicando por que essa seção ainda não está liberada pro seller. */
export default function SellerLocked({ seller }: { seller: SellerProfile }) {
  const conteudo =
    seller.status === "bloqueado" ? (
      { icon: <XCircle size={20} className="text-red-500" />, texto: "Seu acesso está bloqueado no momento. Fale com nosso time para mais informações." }
    ) : !seller.emailConfirmado ? (
      { icon: <MailWarning size={20} className="text-yellow-600" />, texto: "Confirme seu e-mail (link que mandamos no cadastro) pra gente analisar seu documento e liberar essa área." }
    ) : (
      { icon: <Clock size={20} className="text-yellow-600" />, texto: "Seu cadastro está em análise pelo nosso time. Essa área é liberada automaticamente assim que for aprovado." }
    );

  return (
    <Card>
      <CardBody className="flex items-center gap-3 text-sm text-neutral-600">
        <span className="shrink-0">{conteudo.icon}</span>
        <span>
          {conteudo.texto}{" "}
          <Link href="/drop/dashboard" className="text-brand hover:underline">
            Voltar ao início
          </Link>
        </span>
      </CardBody>
    </Card>
  );
}
