"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function MarcaRecuperarSenhaPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const siteUrl  = window.location.origin;
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/marca/nova-senha`,
      });
      if (err) throw err;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao enviar e-mail");
    } finally { setLoading(false); }
  }

  const inp = "w-full pl-10 pr-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/marca/login" className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors mb-6 w-fit">
          <ArrowLeft size={13} /> Voltar ao login
        </Link>

        {sent ? (
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-8 text-center space-y-3">
            <CheckCircle size={32} className="text-green-400 mx-auto" />
            <p className="text-white font-bold">E-mail enviado!</p>
            <p className="text-gray-500 text-sm">Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.</p>
            <Link href="/marca/login" className="block mt-4 text-xs text-brand hover:underline">Voltar ao login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-dark-800 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="mb-2">
              <h1 className="text-lg font-black text-white">Recuperar senha</h1>
              <p className="text-gray-500 text-xs mt-1">Informe seu e-mail para receber o link de redefinição.</p>
            </div>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com" required className={inp} />
            </div>
            {error && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-all text-sm disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
