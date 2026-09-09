"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileText, Ban } from "lucide-react";
import {
  confirmarPedidoDrop,
  faturarPedidoDrop,
  cancelarPedidoDrop,
} from "@/lib/sistema/actions/pedido-drop";
import { FORMA_RECEBIMENTO_OPTIONS } from "@/lib/sistema/types";
import { Modal, ConfirmDialog } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import { Field, Input, Select, FormGrid } from "@/components/sistema/ui/Field";

export default function PedidoDropActions({
  id,
  status,
  podeFaturar,
}: {
  id: string;
  status: string;
  podeFaturar: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fatOpen, setFatOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [nf, setNf] = useState("");
  const [venc, setVenc] = useState("");
  const [forma, setForma] = useState("pix");

  const podeConfirmar = ["orcamento", "aguardando_aprovacao"].includes(status);
  const terminal = ["cancelado", "entregue"].includes(status);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(msg);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {podeConfirmar && (
        <button
          onClick={() => run(() => confirmarPedidoDrop(id), "Pedido confirmado — estoque baixado.")}
          disabled={pending}
          className={buttonClass({ size: "sm" })}
        >
          <CheckCircle2 size={14} /> Confirmar (baixa estoque)
        </button>
      )}
      {status === "confirmado" && podeFaturar && (
        <button onClick={() => setFatOpen(true)} disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
          <FileText size={14} /> Faturar
        </button>
      )}
      {!terminal && (
        <button
          onClick={() => setCancelOpen(true)}
          disabled={pending}
          className={buttonClass({ variant: "outline", size: "sm" })}
        >
          <Ban size={14} /> Cancelar
        </button>
      )}

      <Modal
        open={fatOpen}
        onClose={() => setFatOpen(false)}
        title="Faturar pedido drop"
        footer={
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await faturarPedidoDrop(id, { numero_nf: nf, vencimento: venc, forma });
                setFatOpen(false);
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success("Faturado — conta a receber gerada.");
                  router.refresh();
                }
              })
            }
          >
            Faturar e gerar cobrança
          </Button>
        }
      >
        <div className="space-y-4">
          <FormGrid>
            <Field label="Nº da NF"><Input value={nf} onChange={(e) => setNf(e.target.value)} /></Field>
            <Field label="Vencimento"><Input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} /></Field>
            <Field label="Forma">
              <Select value={forma} onChange={(e) => setForma(e.target.value)}>
                {FORMA_RECEBIMENTO_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </Field>
          </FormGrid>
          <p className="text-xs text-neutral-400">
            Gera uma conta a receber para o seller no valor total do pedido.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false);
          run(() => cancelarPedidoDrop(id), "Pedido cancelado.");
        }}
        title="Cancelar pedido drop?"
        message="Se já tinha baixado estoque, ele será estornado. Contas a receber em aberto serão canceladas."
        confirmLabel="Cancelar pedido"
        danger
        loading={pending}
      />
    </div>
  );
}
