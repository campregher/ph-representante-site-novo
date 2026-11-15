"use client";

import { useState } from "react";
import { toast } from "sonner";
import { salvarFaturadorAtivo } from "@/lib/sistema/actions/seller-faturador";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Checkbox } from "@/components/sistema/ui/Field";
import { Badge } from "@/components/sistema/ui/Badge";

export default function FaturadorConfigCard({ initial }: { initial: boolean }) {
  const [ativo, setAtivo] = useState(initial);
  const [salvando, setSalvando] = useState(false);

  async function alternar(checked: boolean) {
    setSalvando(true);
    const res = await salvarFaturadorAtivo(checked);
    setSalvando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAtivo(checked);
    toast.success(checked ? "Faturador marcado como ativo." : "Faturador marcado como não configurado.");
  }

  return (
    <Card>
      <CardHeader
        title="Faturador do Mercado Livre"
        description="Emissor fiscal nativo do ML — com ele ativo, a nota fiscal da venda pode ser emitida direto por lá."
      />
      <CardBody className="space-y-3">
        <div className="space-y-1.5 text-sm text-neutral-600">
          <p>Pra ativar, no painel do Mercado Livre (fora daqui) você precisa ter:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>CNPJ e Inscrição Estadual atualizados</li>
            <li>Certificado digital tipo A1 cadastrado no Mercado Livre</li>
          </ul>
        </div>
        <div className="flex items-center justify-between gap-2.5 rounded-lg border border-neutral-200 p-3">
          <Checkbox
            label="Já ativei o Faturador no painel do Mercado Livre"
            checked={ativo}
            disabled={salvando}
            onChange={(e) => alternar(e.target.checked)}
          />
          {ativo && <Badge tone="green">Ativo</Badge>}
        </div>
      </CardBody>
    </Card>
  );
}
