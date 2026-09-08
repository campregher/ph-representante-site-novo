"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/sistema/ui/Button";
import AuthCard, { authInputClass } from "@/components/sistema/AuthCard";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/callback?next=/nova-senha`,
    });
    setLoading(false);
    if (error) {
      setError("Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.");
      return;
    }
    setSent(true);
  }

  return (
    <AuthCard
      title="Recuperar senha"
      subtitle="Enviaremos um link para você definir uma nova senha."
      footer={
        <Link href="/login" className="text-brand hover:underline">
          Voltar ao login
        </Link>
      }
    >
      {sent ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 ring-1 ring-inset ring-green-200">
          Se existir uma conta para <strong>{email}</strong>, o link de redefinição foi enviado.
          Confira sua caixa de entrada.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="relative">
            <Mail
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@phrepresentante.com.br"
              className={authInputClass}
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-200">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full">
            Enviar link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
