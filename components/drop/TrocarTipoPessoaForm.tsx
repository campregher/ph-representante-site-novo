"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { trocarTipoPessoaSeller } from "@/lib/sistema/actions/seller-onboarding";
import { formatCNPJ, formatCPF } from "@/utils/cnpj";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input } from "@/components/sistema/ui/Field";

export default function TrocarTipoPessoaForm({
  portalToken,
  tipoPessoaAtual,
}: {
  portalToken: string;
  tipoPessoaAtual: "juridica" | "fisica";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [trocando, setTrocando] = useState(false);
  const [documento, setDocumento] = useState("");
  const [aceite, setAceite] = useState(false);

  const novoTipo = tipoPessoaAtual === "juridica" ? "fisica" : "juridica";
  const label = tipoPessoaAtual === "juridica" ? "Pessoa Jurídica (CNPJ)" : "Pessoa Física (CPF)";
  const novoLabel = novoTipo === "juridica" ? "CNPJ" : "CPF";

  function formatarDocumento(v: string) {
    return novoTipo === "juridica" ? formatCNPJ(v) : formatCPF(v);
  }

  function confirmar() {
    if (!aceite) return toast.error("Confirme que entendeu a mudança de condições.");
    start(async () => {
      const res = await trocarTipoPessoaSeller(portalToken, { novoTipo, novoDocumento: documento, aceite: true });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Cadastro atualizado para ${novoLabel}.`);
      setTrocando(false);
      setDocumento("");
      setAceite(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader title="Tipo de cadastro" />
      <CardBody className="space-y-4">
        <p className="text-sm text-neutral-600">
          Seu cadastro está como <strong>{label}</strong>.
        </p>

        {!trocando ? (
          <Button variant="outline" onClick={() => setTrocando(true)}>
            Mudar para {novoLabel}
          </Button>
        ) : (
          <div className="max-w-sm space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p>
                {novoTipo === "juridica"
                  ? "Mudando pra CNPJ, você passa a ver o custo real de fábrica e negocia o pagamento direto com o fornecedor — sem passar pela PH."
                  : "Mudando pra CPF, você compra direto da PH (preço de revenda, sem ver custo de fábrica) e paga à vista por Pix antes do envio de cada pedido."}
              </p>
            </div>
            <Field label={`Novo ${novoLabel}`}>
              <Input
                value={documento}
                onChange={(e) => setDocumento(formatarDocumento(e.target.value))}
                inputMode="numeric"
                placeholder={novoTipo === "juridica" ? "00.000.000/0000-00" : "000.000.000-00"}
              />
            </Field>
            <label className="flex items-start gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand" />
              Entendi e aceito a troca de preços e condições.
            </label>
            <div className="flex gap-2">
              <Button onClick={confirmar} loading={pending}>Confirmar troca</Button>
              <Button variant="outline" onClick={() => setTrocando(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
