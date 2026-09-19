"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { alterarStatusPedido } from "@/lib/sistema/actions/pedidos";
import { Button } from "@/components/sistema/ui/Button";

/** Sai da fila de despacho assim que marcado — a lista só mostra
 *  confirmado/faturado (pendentes de envio). */
export default function DespachoRowActions({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function postar() {
    start(async () => {
      const res = await alterarStatusPedido(pedidoId, "em_transporte", "Postado — marcado na fila de despacho");
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Pedido marcado como postado.");
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={postar} loading={pending}>
      <Truck size={13} /> Postar
    </Button>
  );
}
