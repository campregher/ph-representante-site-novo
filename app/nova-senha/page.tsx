"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/sistema/ui/Button";
import AuthCard, { authInputClass } from "@/components/sistema/AuthCard";

export default function NovaSenhaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // A sessão de recuperação é criada pelo /auth/callback (verifyOtp) ou pelo
    // fragmento da URL. Confirma que há sessão antes de permitir troca.
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setError("Link inválido ou expirado. Solicite um novo em Recuperar senha.");
      setReady(true);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      setError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (senha !== senha2) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password: senha });
    setLoading(false);
    if (error) {
      setError("Não foi possível alterar a senha. Tente novamente.");
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/sistema");
      router.refresh();
    }, 1500);
  }

  return (
    <AuthCard title="Definir nova senha">
      {done ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 ring-1 ring-inset ring-green-200">
          Senha alterada. Redirecionando…
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="relative">
            <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="password"
              required
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Nova senha (mín. 8 caracteres)"
              className={authInputClass}
              disabled={!ready}
            />
          </div>
          <div className="relative">
            <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="password"
              required
              autoComplete="new-password"
              value={senha2}
              onChange={(e) => setSenha2(e.target.value)}
              placeholder="Repita a nova senha"
              className={authInputClass}
              disabled={!ready}
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-200">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full" disabled={!ready}>
            Salvar senha
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
