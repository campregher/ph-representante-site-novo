"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonClass } from "@/components/sistema/ui/Button";
import { ConfirmDialog } from "@/components/sistema/ui/Modal";
import { toggleProdutoAtivo, deleteProduto } from "@/lib/sistema/actions/produtos";

export default function ProdutoActions({
  id,
  ativo,
  canManage,
}: {
  id: string;
  ativo: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDel, setConfirmDel] = useState(false);

  if (!canManage) return null;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/sistema/produtos/${id}/editar`}
        className={buttonClass({ variant: "outline", size: "sm" })}
      >
        <Pencil size={14} /> Editar
      </Link>
      <Button
        variant="outline"
        size="sm"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await toggleProdutoAtivo(id, !ativo);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success(!ativo ? "Produto ativado." : "Produto inativado.");
              router.refresh();
            }
          })
        }
      >
        <Power size={14} /> {ativo ? "Inativar" : "Ativar"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>
        <Trash2 size={14} className="text-red-500" />
      </Button>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() =>
          startTransition(async () => {
            const res = await deleteProduto(id);
            if (!res.ok) {
              toast.error(res.error);
              setConfirmDel(false);
            } else {
              toast.success("Produto excluído.");
              router.push("/sistema/produtos");
              router.refresh();
            }
          })
        }
        title="Excluir produto"
        message="Esta ação não pode ser desfeita. Pedidos já lançados mantêm o snapshot do item."
        confirmLabel="Excluir"
        danger
        loading={pending}
      />
    </div>
  );
}
