"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, AlertTriangle, RotateCcw } from "lucide-react";
import { marcarComissao } from "@/lib/sistema/actions/comissoes";

export default function ComissaoRowActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function acao(novo: "a_receber" | "recebida" | "divergencia") {
    start(async () => {
      const res = await marcarComissao(id, novo);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Comissão atualizada.");
        router.refresh();
      }
    });
  }

  const btn =
    "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium disabled:opacity-50";

  return (
    <div className="flex justify-end gap-1">
      {status !== "recebida" && (
        <button
          className={`${btn} border-green-300 text-green-700 hover:bg-green-50`}
          disabled={pending}
          onClick={() => acao("recebida")}
        >
          <Check size={13} /> Recebida
        </button>
      )}
      {status !== "divergencia" && (
        <button
          className={`${btn} border-amber-300 text-amber-700 hover:bg-amber-50`}
          disabled={pending}
          onClick={() => acao("divergencia")}
        >
          <AlertTriangle size={13} /> Divergência
        </button>
      )}
      {status !== "a_receber" && (
        <button
          className={`${btn} border-neutral-300 text-neutral-600 hover:bg-neutral-50`}
          disabled={pending}
          onClick={() => acao("a_receber")}
        >
          <RotateCcw size={13} /> Reabrir
        </button>
      )}
    </div>
  );
}
