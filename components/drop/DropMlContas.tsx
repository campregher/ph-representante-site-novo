"use client";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ShoppingBag, Unlink, Plus } from "lucide-react";
import { desconectarMlConta } from "@/lib/sistema/actions/seller-portal";
import { Button } from "@/components/sistema/ui/Button";

export interface MlContaItem {
  id: string;
  nickname: string | null;
}

export default function DropMlContas({ token, contas }: { token: string; contas: MlContaItem[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  useEffect(() => {
    const ml = sp.get("ml");
    if (ml === "conectado") toast.success("Conta do Mercado Livre conectada!");
    if (ml === "erro") toast.error(sp.get("detalhe") || "Falha ao conectar o Mercado Livre.");
    if (ml) router.replace("/drop/dashboard/integracao");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function desconectar(contaId: string) {
    start(async () => {
      const res = await desconectarMlConta(token, contaId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Conta do Mercado Livre desconectada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {contas.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50 text-yellow-600">
              <ShoppingBag size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">{c.nickname ?? "Conta ML"}</p>
              <p className="text-xs text-neutral-500">Conectado</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => desconectar(c.id)} loading={pending}>
            <Unlink size={14} /> Desconectar
          </Button>
        </div>
      ))}

      <a href={`/api/drop/ml/connect?token=${token}`} className="block">
        <Button variant="outline" size="sm" type="button" className="w-full">
          <Plus size={14} /> {contas.length > 0 ? "Conectar outra conta" : "Conectar conta do Mercado Livre"}
        </Button>
      </a>
      {contas.length > 0 && (
        <p className="text-xs text-neutral-400">
          Pra conectar outra conta, saia da conta atual no mercadolivre.com.br antes de clicar (ou use uma aba anônima) — senão o ML autoriza de novo a mesma conta.
        </p>
      )}
    </div>
  );
}
