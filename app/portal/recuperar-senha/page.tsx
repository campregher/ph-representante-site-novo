"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RecuperarSenhaPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/portal/nova-senha`,
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

        <Link href="/portal/login" className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors mb-6 w-fit">
          <ArrowLeft size={13} /> Voltar ao login
        </Link>

        <div className="text-center mb-8">
          <Image src="/images/ph.png" alt="PH Representante" width={140} height={36} className="object-contain h-9 w-auto mx-auto mb-6" />
          <h1 className="text-xl font-black text-white">Recuperar senha</h1>
          <p className="text-gray-500 text-sm mt-1">Enviaremos um link para redefinir sua senha</p>
        </div>

        {sent ? (
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 text-center space-y-3">
            <CheckCircle2 size={36} className="text-green-400 mx-auto" />
            <p className="text-white font-bold text-sm">E-mail enviado!</p>
            <p className="text-gray-400 text-xs leading-relaxed">
              Verifique sua caixa de entrada em <span className="text-white">{email}</span> e clique no link para criar uma nova senha.
            </p>
            <p className="text-gray-600 text-xs">Não recebeu? Verifique o spam ou tente novamente.</p>
            <button onClick={() => setSent(false)} className="text-xs text-brand hover:underline mt-1">
              Tentar com outro e-mail
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-dark-800 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required className={inp}
              />
            </div>

            {error && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-all text-sm disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
