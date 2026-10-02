"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Ban, Trash2, Undo2 } from "lucide-react";
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
  const [confirm, setConfirm] = useState<null | "cancelar" | "excluir" | "orcamento">(null);

  const cancelavel = !["cancelado", "entregue", "faturado"].includes(status);
  const podeVoltarOrcamento = status !== "orcamento" && status !== "cancelado";
  const eraVenda = ["confirmado", "faturado", "em_transporte", "entregue", "pendencia"].includes(status);

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

      {podeVoltarOrcamento && (
        <Button variant="outline" size="sm" onClick={() => setConfirm("orcamento")}>
          <Undo2 size={14} /> Voltar para orçamento
        </Button>
      )}

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
        open={confirm === "orcamento"}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          startTransition(async () => {
            const res = await alterarStatusPedido(id, "orcamento", "Revertido para orçamento");
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Pedido voltou para orçamento.");
              setConfirm(null);
              router.refresh();
            }
          })
        }
        title="Voltar para orçamento"
        message={
          eraVenda
            ? "Esse pedido já conta como venda confirmada. Voltar para orçamento NÃO desfaz estoque, comissão ou conta a receber já gerados a partir dele — só muda o status. Continuar?"
            : "O pedido volta a ficar editável como orçamento."
        }
        confirmLabel="Voltar para orçamento"
        danger={eraVenda}
        loading={pending}
      />

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
