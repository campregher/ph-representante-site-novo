import Link from "next/link";
import { Lock } from "lucide-react";
import SignOutButton from "./SignOutButton";

export default function AccessDenied({ email }: { email: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <Lock size={22} />
        </div>
        <h1 className="text-lg font-bold text-neutral-900">Acesso negado</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {email ? (
            <>
              A conta <span className="font-medium text-neutral-700">{email}</span> está autenticada,
            </>
          ) : (
            "Sua conta está autenticada,"
          )}{" "}
          mas ainda não tem permissão para o Sistema Comercial. Peça a um administrador para ativar
          seu perfil.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Voltar ao site
          </Link>
          <SignOutButton variant="plain" />
        </div>
      </div>
    </div>
  );
}
