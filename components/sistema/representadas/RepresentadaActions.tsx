"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonClass } from "@/components/sistema/ui/Button";
import { ConfirmDialog } from "@/components/sistema/ui/Modal";
import {
  toggleRepresentadaAtiva,
  deleteRepresentada,
} from "@/lib/sistema/actions/representadas";

export default function RepresentadaActions({
  id,
  ativa,
  canManage,
}: {
  id: string;
  ativa: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDel, setConfirmDel] = useState(false);

  if (!canManage) return null;

  function toggle() {
    startTransition(async () => {
      const res = await toggleRepresentadaAtiva(id, !ativa);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(!ativa ? "Representada ativada." : "Representada inativada.");
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteRepresentada(id);
      if (!res.ok) {
        toast.error(res.error);
        setConfirmDel(false);
      } else {
        toast.success("Representada excluída.");
        router.push("/sistema/representadas");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Link href={`/sistema/representadas/${id}/editar`} className={buttonClass({ variant: "outline", size: "sm" })}>
        <Pencil size={14} /> Editar
      </Link>
      <Button variant="outline" size="sm" onClick={toggle} loading={pending}>
        <Power size={14} /> {ativa ? "Inativar" : "Ativar"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>
        <Trash2 size={14} className="text-red-500" />
      </Button>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={remove}
        title="Excluir representada"
        message="Esta ação não pode ser desfeita. Só é possível excluir se não houver produtos, tabelas ou pedidos vinculados."
        confirmLabel="Excluir"
        danger
        loading={pending}
      />
    </div>
  );
}
