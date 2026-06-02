"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, Clock, XCircle, ShoppingBag, Loader2, Building2, ShieldAlert, BookOpen } from "lucide-react";

interface Acesso {
  status: string;
  bloqueado: boolean;
  condicoes_pagamento_drop: string[];
}
interface Marca {
  id: string; slug: string; name: string; segment: string | null; logo_url: string | null;
  acesso: Acesso | null;
}

const CONDICOES_LABEL: Record<string, string> = { pix: "PIX", boleto: "Boleto", semanal: "Semanal" };

export default function PortalMarcasPage() {
  const router  = useRouter();
  const [marcas,     setMarcas]     = useState<Marca[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [solicitando, setSolicitando] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/portal/marcas");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMarcas(Array.isArray(data) ? data : []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar marcas"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function solicitarAcesso(slug: string) {
    setSolicitando(slug);
    try {
      const res  = await fetch("/api/portal/marcas/solicitar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ marca_slug: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Solicitação enviada! Aguarde a aprovação da marca.");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao solicitar acesso"); }
    finally { setSolicitando(null); }
  }

  const aprovadas = marcas.filter(m => m.acesso?.status === "aprovado" && !m.acesso.bloqueado);
  const pendentes = marcas.filter(m => m.acesso?.status === "pendente" || (m.acesso?.status === "aprovado" && m.acesso.bloqueado) || m.acesso?.status === "recusado");
  const semAcesso = marcas.filter(m => !m.acesso);

  return (
    <div className="min-h-screen">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-white">Marcas</h1>
            {!loading && (
              <p className="text-xs text-gray-500">
                {aprovadas.length} aprovada{aprovadas.length !== 1 ? "s" : ""} · {semAcesso.length} disponível{semAcesso.length !== 1 ? "is" : ""}
              </p>
            )}
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {loading ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            {/* ── Aprovadas ── */}
            {aprovadas.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Com acesso</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {aprovadas.map((m) => (
                    <div key={m.slug} className="bg-dark-800 border border-green-400/20 rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-dark-700 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {m.logo_url
                            ? <Image src={m.logo_url} alt={m.name} width={48} height={48} className="object-contain w-full h-full p-1" unoptimized />
                            : <Building2 size={20} className="text-gray-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white">{m.name}</p>
                          {m.segment && <p className="text-xs text-gray-500 mt-0.5">{m.segment}</p>}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <CheckCircle size={11} className="text-green-400" />
                            <span className="text-[11px] text-green-400 font-semibold">Aprovado</span>
                          </div>
                        </div>
                      </div>

                      {m.acesso && m.acesso.condicoes_pagamento_drop.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Pagamento DROP</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {m.acesso.condicoes_pagamento_drop.map(c => (
                              <span key={c} className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-brand/10 text-brand border border-brand/20">
                                {CONDICOES_LABEL[c] ?? c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/portal/marcas/${m.slug}/catalogo`)}
                          className="flex items-center justify-center gap-1.5 flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all"
                        >
                          <BookOpen size={13} /> Catálogo
                        </button>
                        <button
                          onClick={() => router.push(`/portal/orcamentos/novo`)}
                          className="flex items-center justify-center gap-1.5 flex-1 py-2.5 bg-brand/15 hover:bg-brand/25 text-brand border border-brand/30 rounded-xl text-xs font-bold transition-all"
                        >
                          <ShoppingBag size={13} /> Novo pedido
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Pendentes / Bloqueadas / Recusadas ── */}
            {pendentes.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Solicitações</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pendentes.map((m) => {
                    const status   = m.acesso?.status;
                    const bloqueado = m.acesso?.bloqueado;
                    return (
                      <div key={m.slug} className={`bg-dark-800 border rounded-2xl p-5 flex items-center gap-4 ${
                        bloqueado ? "border-orange-400/20" : status === "recusado" ? "border-red-400/15" : "border-white/8"
                      }`}>
                        <div className="w-12 h-12 rounded-xl bg-dark-700 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {m.logo_url
                            ? <Image src={m.logo_url} alt={m.name} width={48} height={48} className="object-contain w-full h-full p-1" unoptimized />
                            : <Building2 size={20} className="text-gray-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white">{m.name}</p>
                          {m.segment && <p className="text-xs text-gray-500 mt-0.5">{m.segment}</p>}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {bloqueado ? (
                              <><ShieldAlert size={11} className="text-orange-400" /><span className="text-[11px] text-orange-400 font-semibold">Bloqueado</span></>
                            ) : status === "recusado" ? (
                              <><XCircle size={11} className="text-red-400" /><span className="text-[11px] text-red-400 font-semibold">Recusado</span></>
                            ) : (
                              <><Clock size={11} className="text-yellow-400" /><span className="text-[11px] text-yellow-400 font-semibold">Aguardando aprovação</span></>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/portal/marcas/${m.slug}/catalogo`)}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-300 hover:text-white bg-dark-700 border border-white/10 hover:border-white/25 rounded-xl transition-all flex-shrink-0"
                        >
                          <BookOpen size={12} /> Catálogo
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Sem acesso ── */}
            {semAcesso.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Solicitar acesso</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {semAcesso.map((m) => (
                    <div key={m.slug} className="bg-dark-800 border border-white/8 rounded-2xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-dark-700 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {m.logo_url
                          ? <Image src={m.logo_url} alt={m.name} width={48} height={48} className="object-contain w-full h-full p-1 opacity-50" unoptimized />
                          : <Building2 size={20} className="text-gray-700" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{m.name}</p>
                        {m.segment && <p className="text-xs text-gray-500 mt-0.5">{m.segment}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => router.push(`/portal/marcas/${m.slug}/catalogo`)}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-400 hover:text-white bg-dark-700 border border-white/10 hover:border-white/25 rounded-xl transition-all"
                        >
                          <BookOpen size={12} /> Catálogo
                        </button>
                        <button
                          onClick={() => solicitarAcesso(m.slug)}
                          disabled={solicitando === m.slug}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-dark-700 border border-white/15 hover:border-white/30 hover:bg-dark-600 rounded-xl transition-all disabled:opacity-50"
                        >
                          {solicitando === m.slug ? <Loader2 size={12} className="animate-spin" /> : null}
                          Solicitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {marcas.length === 0 && (
              <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center">
                <Building2 size={28} className="text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Nenhuma marca disponível.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
