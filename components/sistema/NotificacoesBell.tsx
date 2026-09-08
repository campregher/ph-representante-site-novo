"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import type { Notificacao } from "@/lib/sistema/notificacoes";
import { marcarNotificacaoLida, marcarTodasLidas } from "@/lib/sistema/actions/notificacoes";

function tempoRel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

export default function NotificacoesBell({
  itens,
  naoLidas,
}: {
  itens: Notificacao[];
  naoLidas: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function abrir(n: Notificacao) {
    setOpen(false);
    start(async () => {
      if (!n.lida) await marcarNotificacaoLida(n.id);
      if (n.link) router.push(n.link);
      else router.refresh();
    });
  }

  function todasLidas() {
    start(async () => {
      await marcarTodasLidas();
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
        aria-label="Notificações"
      >
        <Bell size={18} />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-80 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">
              Notificações
            </span>
            {naoLidas > 0 && (
              <button
                onClick={todasLidas}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                <CheckCheck size={13} /> Marcar todas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {itens.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-neutral-400">
                Nenhuma notificação.
              </p>
            ) : (
              itens.map((n) => (
                <button
                  key={n.id}
                  onClick={() => abrir(n)}
                  className={`flex w-full flex-col items-start gap-0.5 border-b border-neutral-50 px-3 py-2.5 text-left last:border-0 hover:bg-neutral-50 ${
                    n.lida ? "" : "bg-brand/[0.03]"
                  }`}
                >
                  <div className="flex w-full items-center gap-2">
                    {!n.lida && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
                      {n.titulo}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-400">
                      {tempoRel(n.created_at)}
                    </span>
                  </div>
                  {n.descricao && (
                    <span className="line-clamp-2 text-xs text-neutral-500">{n.descricao}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
