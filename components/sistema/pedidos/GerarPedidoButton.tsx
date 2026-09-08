"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { alterarStatusPedido } from "@/lib/sistema/actions/pedidos";
import { Button } from "@/components/sistema/ui/Button";

export default function GerarPedidoButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await alterarStatusPedido(id, "confirmado", "Pedido gerado");
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Pedido gerado.");
            router.push("/sistema/pedidos");
            router.refresh();
          }
        })
      }
    >
      <CheckCircle2 size={14} /> Gerar pedido
    </Button>
  );
}
