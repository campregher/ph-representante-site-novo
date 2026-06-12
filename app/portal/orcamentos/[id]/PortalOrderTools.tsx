"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Printer, MessageSquare, Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  orcamentoId: string;
  printApiPath: string;
  observacoesAtuais: string | null;
}

export default function PortalOrderTools({ orcamentoId, printApiPath, observacoesAtuais }: Props) {
  const [showObs,   setShowObs]   = useState(false);
  const [obs,       setObs]       = useState(observacoesAtuais ?? "");
  const [sending,   setSending]   = useState(false);

  async function handleSend() {
    const trimmed = obs.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const res = await fetch(`/api/portal/orcamentos/${orcamentoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enviar_observacao", observacao: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
      toast.success("Observação enviada para a marca!");
      setShowObs(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setSending(false); }
  }

  return (
    <div className="print:hidden bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/8">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Ações do pedido</p>
      </div>

      <div className="p-4 space-y-2">
        {/* Imprimir */}
        <button
          onClick={() => window.open(printApiPath, "_blank")}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-sm font-semibold rounded-xl transition-all"
        >
          <Printer size={13} /> Imprimir pedido
        </button>

        {/* Enviar observação */}
        <button
          onClick={() => setShowObs(!showObs)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-sm font-semibold rounded-xl transition-all"
        >
          <span className="flex items-center gap-2">
            <MessageSquare size={13} /> Observação para a marca
          </span>
          {showObs ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {showObs && (
          <div className="bg-dark-900/60 border border-white/8 rounded-xl p-4 space-y-3">
            <p className="text-xs text-gray-500">
              Esta mensagem será enviada por email à marca e ficará registrada no pedido.
            </p>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: Favor incluir nota fiscal impressa, endereço de entrega alternativo…"
              rows={3}
              className="w-full px-3 py-2.5 bg-dark-800 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand/50 resize-none"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleSend}
                disabled={sending || !obs.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40"
              >
                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Enviar para a marca
              </button>
              <button
                onClick={() => setShowObs(false)}
                className="px-3 py-2.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
