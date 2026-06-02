"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Lock, CheckCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function MarcaNovaSenhaPage() {
  const router = useRouter();
  // Single client instance shared between setSession and updateUser
  const supabase = useRef(createClient());
  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");
  const [ready,     setReady]     = useState(false);

  // On mount: if the URL has recovery tokens in the hash, establish the session
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) { setReady(true); return; }

    const params       = new URLSearchParams(hash);
    const accessToken  = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type         = params.get("type");

    if (type === "recovery" && accessToken && refreshToken) {
      supabase.current.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error: err }) => {
          if (err || !data.session) {
            setError("Link inválido ou expirado. Solicite um novo link de acesso.");
          }
          window.history.replaceState(null, "", window.location.pathname);
        })
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) { setError("As senhas não coincidem."); return; }
    if (password.length < 6)    { setError("A senha deve ter pelo menos 6 caracteres."); return; }
    setLoading(true); setError("");
    try {
      const { error: err } = await supabase.current.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      setTimeout(() => router.push("/marca/login"), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar senha");
    } finally { setLoading(false); }
  }

  const inp = "w-full pl-10 pr-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {done ? (
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-8 text-center space-y-3">
            <CheckCircle size={32} className="text-green-400 mx-auto" />
            <p className="text-white font-bold">Senha atualizada!</p>
            <p className="text-gray-500 text-sm">Redirecionando para o login...</p>
          </div>
        ) : !ready ? (
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-8 text-center space-y-3">
            <Loader2 size={24} className="text-brand animate-spin mx-auto" />
            <p className="text-gray-400 text-sm">Verificando link de acesso...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-dark-800 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="mb-2">
              <h1 className="text-lg font-black text-white">Nova senha</h1>
              <p className="text-gray-500 text-xs mt-1">Defina sua senha de acesso ao painel da marca.</p>
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Nova senha" required minLength={6} className={inp} />
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)}
                placeholder="Confirmar nova senha" required className={inp} />
            </div>
            {error && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading || !!error}
              className="w-full py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Salvando..." : "Definir nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
