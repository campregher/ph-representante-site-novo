"use client";

import { useRef, useState, useEffect } from "react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useNotificacoes } from "@/hooks/useNotificacoes";

const ICONES: Record<string, string> = {
  novo_pedido:      "🛒",
  pedido_aprovado:  "✅",
  pedido_enviado:   "📦",
  pedido_pago:      "💰",
  pedido_recusado:  "❌",
  acesso_solicitado:"🔔",
  acesso_aprovado:  "🎉",
  acesso_recusado:  "🚫",
};

function tempo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)   return "agora";
  if (min < 60)  return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function SinoNotificacoes() {
  const { notificacoes, naoLidas, loading, marcarLida, marcarTodasLidas } = useNotificacoes();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-xl text-gray-400 hover:text-white hover:bg-white/8 transition-all"
        aria-label="Notificações"
      >
        <Bell size={16} />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-brand rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-10 z-50 w-80 bg-dark-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <span className="text-sm font-semibold text-white">Notificações</span>
            {naoLidas > 0 && (
              <button
                onClick={marcarTodasLidas}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand transition-colors"
              >
                <CheckCheck size={12} /> Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-white/5">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">Carregando...</div>
            ) : notificacoes.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Nenhuma notificação
              </div>
            ) : (
              notificacoes.map((n) => {
                const Wrapper = n.link ? Link : "div";
                const wrapperProps = n.link
                  ? { href: n.link, onClick: () => { marcarLida(n.id); setAberto(false); } }
                  : {};

                return (
                  // @ts-expect-error – props dinâmicas entre Link e div
                  <Wrapper
                    key={n.id}
                    {...wrapperProps}
                    className={`flex gap-3 px-4 py-3 transition-colors cursor-pointer group ${
                      n.lida ? "opacity-60" : "bg-brand/5 hover:bg-brand/10"
                    } hover:bg-white/5`}
                    onClick={() => !n.link && marcarLida(n.id)}
                  >
                    <span className="text-lg leading-none mt-0.5 flex-shrink-0">
                      {ICONES[n.tipo] ?? "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${n.lida ? "text-gray-400" : "text-white font-medium"}`}>
                        {n.titulo}
                      </p>
                      {n.mensagem && (
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.mensagem}</p>
                      )}
                      <p className="text-[10px] text-gray-600 mt-1">{tempo(n.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {!n.lida && (
                        <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0 mt-1" />
                      )}
                      {n.link && (
                        <ExternalLink size={11} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                      )}
                    </div>
                  </Wrapper>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
