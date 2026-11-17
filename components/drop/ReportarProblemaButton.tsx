"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { MessageSquareWarning } from "lucide-react";
import { reportarProblema } from "@/lib/sistema/actions/relatos-problema";
import { Modal } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, Textarea } from "@/components/sistema/ui/Field";

/** Botão fixo no menu do seller — abre um formulário simples pra reportar
 *  um problema na plataforma, de qualquer tela. Captura a página atual
 *  automaticamente (pra quem for investigar saber onde aconteceu). */
export default function ReportarProblemaButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!descricao.trim()) {
      toast.error("Descreva o que aconteceu.");
      return;
    }
    setEnviando(true);
    try {
      const res = await reportarProblema(titulo, descricao, pathname);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Problema reportado — nosso time já foi avisado.");
      setOpen(false);
      setTitulo("");
      setDescricao("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
      >
        <MessageSquareWarning size={17} />
        Reportar problema
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reportar um problema"
        footer={
          <Button onClick={enviar} loading={enviando}>
            Enviar
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">
            Conta pra gente o que aconteceu — nosso time recebe o aviso e entra em contato se precisar.
          </p>
          <Field label="Assunto (opcional)">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: etiqueta não baixou" />
          </Field>
          <Field label="O que aconteceu?" required>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              placeholder="Descreva o problema com o máximo de detalhe que conseguir."
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
