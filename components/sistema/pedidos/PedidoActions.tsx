"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/sistema/ui/Button";
import { ConfirmDialog } from "@/components/sistema/ui/Modal";
import { duplicarPedido, alterarStatusPedido, excluirPedido } from "@/lib/sistema/actions/pedidos";

export default function PedidoActions({
  id,
  status,
  canManage,
}: {
  id: string;
  status: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<null | "cancelar" | "excluir">(null);

  const cancelavel = !["cancelado", "entregue", "faturado"].includes(status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await duplicarPedido(id);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Pedido duplicado.");
              router.push(`/sistema/pedidos/${res.id}`);
              router.refresh();
            }
          })
        }
      >
        <Copy size={14} /> Duplicar
      </Button>

      {cancelavel && (
        <Button variant="outline" size="sm" onClick={() => setConfirm("cancelar")}>
          <Ban size={14} /> Cancelar
        </Button>
      )}

      {canManage && (
        <Button variant="ghost" size="sm" onClick={() => setConfirm("excluir")}>
          <Trash2 size={14} className="text-red-500" />
        </Button>
      )}

      <ConfirmDialog
        open={confirm === "cancelar"}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          startTransition(async () => {
            const res = await alterarStatusPedido(id, "cancelado", "Pedido cancelado");
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Pedido cancelado.");
              setConfirm(null);
              router.refresh();
            }
          })
        }
        title="Cancelar pedido"
        message="O pedido será marcado como cancelado. Você ainda poderá consultá-lo e duplicá-lo."
        confirmLabel="Cancelar pedido"
        danger
        loading={pending}
      />

      <ConfirmDialog
        open={confirm === "excluir"}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          startTransition(async () => {
            const res = await excluirPedido(id);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Pedido excluído.");
              router.push("/sistema/pedidos");
              router.refresh();
            }
          })
        }
        title="Excluir pedido"
        message="Ação permanente. Prefira cancelar para manter o histórico."
        confirmLabel="Excluir"
        danger
        loading={pending}
      />
    </div>
  );
}
