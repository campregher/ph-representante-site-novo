import Link from "next/link";
import { Lock } from "lucide-react";
import { buttonClass } from "@/components/sistema/ui/buttonClass";

export default function AcessoNegadoPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <Lock size={22} />
        </div>
        <h1 className="text-lg font-bold text-neutral-900">Sem permissão</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Seu papel não tem acesso a esta área. Se acha que é engano, fale com um administrador.
        </p>
        <Link href="/sistema" className={buttonClass({ variant: "outline", className: "mt-6" })}>
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
