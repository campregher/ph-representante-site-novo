"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveMetaGeral } from "@/lib/sistema/actions/metas";
import { Field, Input, Select, FormGrid } from "@/components/sistema/ui/Field";
import { Button } from "@/components/sistema/ui/Button";
import { formatBRL } from "@/lib/sistema/format";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export default function MetasForm({
  metas,
}: {
  /** metas gerais já cadastradas, por chave "YYYY-MM" */
  metas: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const opcoes = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 2 + i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { value, label: `${MESES[d.getMonth()]} / ${d.getFullYear()}` };
    });
  }, []);

  const [chave, setChave] = useState(opcoes[2]?.value ?? opcoes[0].value);
  const [valor, setValor] = useState(String(metas[chave] ?? ""));

  function trocarMes(k: string) {
    setChave(k);
    setValor(metas[k] != null ? String(metas[k]) : "");
  }

  function salvar() {
    const [ano, mes] = chave.split("-").map(Number);
    start(async () => {
      const res = await saveMetaGeral({ ano, mes, valor_meta: valor || "0" });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Meta salva.");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <FormGrid>
        <Field label="Mês">
          <Select value={chave} onChange={(e) => trocarMes(e.target.value)}>
            {opcoes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
                {metas[o.value] != null ? ` — ${formatBRL(metas[o.value])}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Meta de faturamento (R$)">
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
          />
        </Field>
      </FormGrid>
      <div className="mt-4">
        <Button type="button" onClick={salvar} loading={pending}>
          Salvar meta
        </Button>
      </div>
    </div>
  );
}
