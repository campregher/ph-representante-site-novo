"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { sincronizarTodasComissoes } from "@/lib/sistema/actions/comissoes";

export default function SincronizarComissoesButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() =>
        start(async () => {
          const res = await sincronizarTodasComissoes();
          if (!res.ok) toast.error(res.error);
          else {
            toast.success(`Comissões sincronizadas (${res.total ?? 0} pedidos).`);
            router.refresh();
          }
        })
      }
      disabled={pending}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
    >
      <RefreshCw size={15} className={pending ? "animate-spin" : ""} />
      {pending ? "Sincronizando…" : "Sincronizar"}
    </button>
  );
}
