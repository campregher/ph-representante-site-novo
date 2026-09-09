"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
import { ajustarEstoque } from "@/lib/sistema/actions/linha-propria";
import { Modal } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input } from "@/components/sistema/ui/Field";

export default function AjusteEstoqueButton({
  produtoId,
  nome,
  saldoAtual,
}: {
  produtoId: string;
  nome: string;
  saldoAtual: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [saldo, setSaldo] = useState(String(saldoAtual));
  const [motivo, setMotivo] = useState("");

  function salvar() {
    start(async () => {
      const res = await ajustarEstoque({ produto_id: produtoId, novo_saldo: saldo, motivo });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Estoque ajustado.");
      setOpen(false);
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setSaldo(String(saldoAtual));
          setOpen(true);
        }}
        className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        title="Ajustar estoque"
      >
        <SlidersHorizontal size={15} />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Ajustar estoque — ${nome}`}
        footer={
          <Button onClick={salvar} loading={pending}>
            Ajustar
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Novo saldo" hint={`Saldo atual: ${saldoAtual}`}>
            <Input value={saldo} onChange={(e) => setSaldo(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Motivo" required>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Inventário, perda, devolução…"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
