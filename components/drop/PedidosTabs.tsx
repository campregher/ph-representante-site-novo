"use client";

import { useState, type ReactNode } from "react";

export interface PedidoTabDef {
  id: string;
  label: string;
  count: number;
  /** Já renderizado pelo Server Component que chama isso — funções não
   *  atravessam a fronteira server/client, só ReactNode. */
  content: ReactNode;
}

/** Abas client-side (sem mudar rota) compartilhadas entre o painel do
 *  seller (/drop/dashboard/pedidos) e o do admin (/sistema/dropshipping/pedidos)
 *  — cada página monta sua própria lista de abas (já filtrada e renderizada
 *  do jeito que faz sentido pra ela: card list no seller, tabela no admin)
 *  e só delega a troca de aba pra este componente. */
export default function PedidosTabs({ tabs }: { tabs: PedidoTabDef[] }) {
  const [tabId, setTabId] = useState(tabs[0]?.id);
  const ativa = tabs.find((t) => t.id === tabId) ?? tabs[0];

  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b border-neutral-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTabId(t.id)}
            className={`relative -mb-px flex items-center gap-1.5 px-1 pb-2.5 text-sm font-semibold transition-colors ${
              ativa?.id === t.id ? "text-brand" : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                ativa?.id === t.id ? "bg-brand/10 text-brand" : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {t.count}
            </span>
            {ativa?.id === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />}
          </button>
        ))}
      </div>
      {ativa?.content}
    </div>
  );
}
