"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/sistema/ui/Modal";
import { deleteTabela } from "@/lib/sistema/actions/tabelas";

export default function TabelaRowDelete({ id, nome }: { id: string; nome: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
        title="Excluir tabela"
      >
        <Trash2 size={15} />
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            const res = await deleteTabela(id);
            if (!res.ok) {
              toast.error(res.error);
              setOpen(false);
            } else {
              toast.success("Tabela excluída.");
              setOpen(false);
              router.refresh();
            }
          })
        }
        title={`Excluir "${nome}"`}
        message="Os preços/overrides desta tabela serão removidos. Pedidos já lançados mantêm o snapshot e não são afetados."
        confirmLabel="Excluir"
        danger
        loading={pending}
      />
    </>
  );
}
