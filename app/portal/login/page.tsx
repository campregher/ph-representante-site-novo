"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, LogIn, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      router.push("/portal/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao fazer login";
      setError(msg.includes("Invalid") ? "Email ou senha incorretos." : msg);
    } finally {
      setLoading(false);
    }
  }

  const inp = "w-full pl-10 pr-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors mb-6 w-fit">
          <ArrowLeft size={13} /> Voltar ao site
        </Link>

        <div className="text-center mb-8">
          <Image src="/images/ph.png" alt="PH Representante" width={140} height={36} className="object-contain h-9 w-auto mx-auto mb-6" />
          <h1 className="text-xl font-black text-white">Portal do Cliente</h1>
          <p className="text-gray-500 text-sm mt-1">Acesse sua conta para ver preços e orçamentos</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-dark-800 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" required className={inp} />
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha" required className={inp} />
          </div>

          {error && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-all text-sm disabled:opacity-50"
          >
            <LogIn size={15} /> {loading ? "Entrando..." : "Entrar"}
          </button>

          <div className="text-center pt-1">
            <Link href="/portal/recuperar-senha" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Esqueci minha senha
            </Link>
          </div>
        </form>

        <p className="text-center text-xs text-gray-600 mt-4">
          Ainda não tem conta?{" "}
          <Link href="/portal/registro" className="text-brand hover:underline">Cadastre sua empresa</Link>
        </p>
      </div>
    </div>
  );
}
