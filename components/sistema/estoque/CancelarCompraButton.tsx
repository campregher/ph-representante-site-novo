"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { cancelarCompra } from "@/lib/sistema/actions/linha-propria";
import { ConfirmDialog } from "@/components/sistema/ui/Modal";

export default function CancelarCompraButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-red-50 hover:text-red-600"
      >
        <Ban size={13} /> Cancelar
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await cancelarCompra(id);
            setOpen(false);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Compra cancelada — estoque estornado.");
              router.refresh();
            }
          })
        }
        title="Cancelar compra?"
        message="O estoque das entradas desta compra será estornado."
        confirmLabel="Cancelar compra"
        danger
        loading={pending}
      />
    </>
  );
}
