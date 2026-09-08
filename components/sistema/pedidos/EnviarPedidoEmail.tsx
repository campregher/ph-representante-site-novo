"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, X } from "lucide-react";
import { enviarPedidoPorEmail } from "@/lib/sistema/actions/enviar-pedido";
import { Modal } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import { Field, Input, Textarea, Checkbox } from "@/components/sistema/ui/Field";

export default function EnviarPedidoEmail({
  pedidoId,
  numero,
  clienteEmail,
  jaEnviado,
}: {
  pedidoId: string;
  numero: number;
  clienteEmail?: string | null;
  jaEnviado?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [para, setPara] = useState(clienteEmail ?? "");
  const [cc, setCc] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [anexarPdf, setAnexarPdf] = useState(true);
  const [copiaParaMim, setCopiaParaMim] = useState(false);

  function enviar() {
    start(async () => {
      const res = await enviarPedidoPorEmail(pedidoId, {
        para,
        cc,
        mensagem,
        anexarPdf,
        copiaParaMim,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Pedido #${numero} enviado para ${res.para?.join(", ")}`);
      setOpen(false);
      setMensagem("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={buttonClass({ variant: jaEnviado ? "outline" : "primary", size: "sm" })}
      >
        <Mail size={14} /> {jaEnviado ? "Reenviar e-mail" : "Enviar por e-mail"}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Enviar pedido #${numero} por e-mail`}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
            >
              <X size={14} /> Cancelar
            </button>
            <Button onClick={enviar} loading={pending}>
              <Mail size={14} /> Enviar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Para" required hint="Vários e-mails separados por vírgula.">
            <Input
              value={para}
              onChange={(e) => setPara(e.target.value)}
              placeholder="cliente@empresa.com.br"
              inputMode="email"
            />
          </Field>
          <Field label="Cópia (CC)">
            <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="opcional" />
          </Field>
          <Field label="Mensagem" hint="Aparece em destaque no topo do e-mail.">
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
              placeholder="Olá! Segue o pedido para sua conferência…"
            />
          </Field>
          <div className="space-y-2">
            <Checkbox
              label="Anexar PDF do pedido"
              checked={anexarPdf}
              onChange={(e) => setAnexarPdf(e.target.checked)}
            />
            <Checkbox
              label="Receber uma cópia"
              checked={copiaParaMim}
              onChange={(e) => setCopiaParaMim(e.target.checked)}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
