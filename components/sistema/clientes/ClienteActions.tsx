"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonClass } from "@/components/sistema/ui/Button";
import { ConfirmDialog } from "@/components/sistema/ui/Modal";
import { deleteCliente } from "@/lib/sistema/actions/clientes";

export default function ClienteActions({
  id,
  canDelete,
}: {
  id: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Link href={`/sistema/clientes/${id}/editar`} className={buttonClass({ variant: "outline", size: "sm" })}>
        <Pencil size={14} /> Editar
      </Link>
      {canDelete && (
        <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>
          <Trash2 size={14} className="text-red-500" />
        </Button>
      )}
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() =>
          startTransition(async () => {
            const res = await deleteCliente(id);
            if (!res.ok) {
              toast.error(res.error);
              setConfirmDel(false);
            } else {
              toast.success("Cliente excluído.");
              router.push("/sistema/clientes");
              router.refresh();
            }
          })
        }
        title="Excluir cliente"
        message="Só é possível excluir se não houver pedidos vinculados. Considere marcar como inativo."
        confirmLabel="Excluir"
        danger
        loading={pending}
      />
    </div>
  );
}
