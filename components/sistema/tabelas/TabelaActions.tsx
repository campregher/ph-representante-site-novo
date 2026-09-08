"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Power, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonClass } from "@/components/sistema/ui/Button";
import { ConfirmDialog } from "@/components/sistema/ui/Modal";
import { toggleTabelaAtiva, deleteTabela } from "@/lib/sistema/actions/tabelas";

export default function TabelaActions({
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/imprimir/tabela/${id}`}
        target="_blank"
        className={buttonClass({ variant: "outline", size: "sm" })}
      >
        <Printer size={14} /> Imprimir
      </Link>
      {!canManage ? null : (
        <>
          <Link
            href={`/sistema/tabelas/${id}/editar`}
            className={buttonClass({ variant: "outline", size: "sm" })}
          >
            <Pencil size={14} /> Editar dados
          </Link>
      <Button
        variant="outline"
        size="sm"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await toggleTabelaAtiva(id, !ativa);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success(!ativa ? "Tabela ativada." : "Tabela inativada.");
              router.refresh();
            }
          })
        }
      >
        <Power size={14} /> {ativa ? "Inativar" : "Ativar"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>
        <Trash2 size={14} className="text-red-500" />
      </Button>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() =>
          startTransition(async () => {
            const res = await deleteTabela(id);
            if (!res.ok) {
              toast.error(res.error);
              setConfirmDel(false);
            } else {
              toast.success("Tabela excluída.");
              router.push("/sistema/tabelas");
              router.refresh();
            }
          })
        }
        title="Excluir tabela de preço"
        message="Todos os preços desta tabela serão removidos. Pedidos já lançados não são afetados (guardam snapshot)."
        confirmLabel="Excluir"
        danger
        loading={pending}
      />
        </>
      )}
    </div>
  );
}
