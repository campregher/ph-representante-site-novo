"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/sistema/ui/Button";
import AuthCard, { authInputClass } from "@/components/sistema/AuthCard";

export default function DropLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/drop/meu-token");
    if (!res.ok) {
      await supabase.auth.signOut();
      setError(
        res.status === 404
          ? "Não encontramos um cadastro de seller para este e-mail."
          : "Não foi possível entrar. Tente novamente."
      );
      setLoading(false);
      return;
    }
    const { token } = await res.json();
    router.push(`/drop/portal/${token}`);
  }

  return (
    <AuthCard
      title="Portal do Seller"
      subtitle="Entre com sua conta de dropshipping PH Representante."
      footer={
        <>
          <Link href="/recuperar-senha" className="text-brand hover:underline">
            Esqueci minha senha
          </Link>
          <span className="mx-2 text-neutral-300">·</span>
          <Link href="/drop/cadastro" className="text-brand hover:underline">
            Não tem conta? Cadastre-se
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <div className="relative">
          <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className={authInputClass}
          />
        </div>
        <div className="relative">
          <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className={authInputClass}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Entrar <ArrowRight size={15} />
        </Button>
      </form>
    </AuthCard>
  );
}
