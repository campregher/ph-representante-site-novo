"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, X, Loader2, AlertTriangle } from "lucide-react";

export default function OrcamentoActions({ id }: { id: string }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling,  setCancelling]  = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/portal/orcamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelar" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao cancelar");
      toast.success("Pedido cancelado.");
      router.push("/portal/orcamentos");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cancelar pedido");
      setCancelling(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href={`/portal/orcamentos/${id}/editar`}
          className="flex items-center gap-2 px-5 py-2.5 bg-dark-700 border border-white/10 text-white text-sm font-semibold rounded-xl hover:border-white/25 transition-all"
        >
          <Pencil size={14} /> Editar pedido
        </Link>
        <button onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 border border-red-500/25 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-all"
        >
          <X size={14} /> Cancelar pedido
        </button>
      </div>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !cancelling && setShowConfirm(false)}
        >
          <div
            className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Cancelar pedido?</p>
                <p className="text-xs text-gray-500 mt-0.5">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} disabled={cancelling}
                className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50"
              >
                Voltar
              </button>
              <button onClick={handleCancel} disabled={cancelling}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling && <Loader2 size={14} className="animate-spin" />}
                {cancelling ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
