"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function NovaSenhaPage() {
  const router = useRouter();
  // Single client instance shared between setSession and updateUser
  const supabase = useRef(createClient());
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [show,      setShow]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");
  const [ready,     setReady]     = useState(false);

  useEffect(() => {
    // PKCE flow: sessão já foi estabelecida pelo /auth/callback — só verifica se existe
    // Legacy flow: tokens no hash (fallback)
    supabase.current.auth.getSession().then(({ data }) => {
      if (data.session) { setReady(true); return; }

      // Tenta o fluxo legado com tokens no hash
      const hash = window.location.hash.slice(1);
      if (!hash) {
        setError("Link inválido ou expirado. Solicite um novo link de acesso.");
        setReady(true);
        return;
      }

      const params       = new URLSearchParams(hash);
      const accessToken  = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type         = params.get("type");

      if (type === "recovery" && accessToken && refreshToken) {
        supabase.current.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data: d, error: err }) => {
            if (err || !d.session) {
              setError("Link inválido ou expirado. Solicite um novo link de acesso.");
            }
            window.history.replaceState(null, "", window.location.pathname);
          })
          .finally(() => setReady(true));
      } else {
        setError("Link inválido ou expirado. Solicite um novo link de acesso.");
        setReady(true);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }
    if (password !== confirm)  { setError("As senhas não coincidem."); return; }
    setLoading(true); setError("");
    try {
      const { error: err } = await supabase.current.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      setTimeout(() => router.push("/portal/login"), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar senha");
    } finally { setLoading(false); }
  }

  const inp = "w-full pl-10 pr-10 py-3 bg-dark-900 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <Link href="/portal/login" className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors mb-6 w-fit">
          <ArrowLeft size={13} /> Voltar ao login
        </Link>

        <div className="text-center mb-8">
          <Image src="/images/ph.png" alt="PH Representante" width={140} height={36} className="object-contain h-9 w-auto mx-auto mb-6" />
          <h1 className="text-xl font-black text-white">Nova senha</h1>
          <p className="text-gray-500 text-sm mt-1">Escolha uma senha segura para sua conta</p>
        </div>

        {done ? (
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 text-center space-y-3">
            <CheckCircle2 size={36} className="text-green-400 mx-auto" />
            <p className="text-white font-bold text-sm">Senha atualizada!</p>
            <p className="text-gray-400 text-xs">Redirecionando para o login...</p>
          </div>
        ) : !ready ? (
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 text-center space-y-3">
            <Loader2 size={24} className="text-brand animate-spin mx-auto" />
            <p className="text-gray-400 text-sm">Verificando link de acesso...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-dark-800 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={show ? "text" : "password"}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Nova senha (mín. 6 caracteres)" required className={inp}
              />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={show ? "text" : "password"}
                value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Confirmar nova senha" required className={inp}
              />
            </div>

            {error && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-all text-sm disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
