"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveMetaVendedor } from "@/lib/sistema/actions/metas";
import { Field, Input, Select, FormGrid } from "@/components/sistema/ui/Field";
import { Button } from "@/components/sistema/ui/Button";
import { formatBRL } from "@/lib/sistema/format";

interface Opt {
  id: string;
  label: string;
}
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export default function MetaVendedorForm({
  vendedores,
  representadas,
  metas,
}: {
  vendedores: Opt[];
  representadas: Opt[];
  /** chave "YYYY-MM|vendedorId|repId|geral" → valor */
  metas: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const opcoesMes = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 2 + i, 1);
      return {
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${MESES[d.getMonth()]} / ${d.getFullYear()}`,
      };
    });
  }, []);

  const [mes, setMes] = useState(opcoesMes[2]?.value ?? opcoesMes[0].value);
  const [vendedor, setVendedor] = useState(vendedores[0]?.id ?? "");
  const [rep, setRep] = useState("");
  const [valor, setValor] = useState("");

  const chave = `${mes}|${vendedor}|${rep || "geral"}`;
  const atual = metas[chave];

  function salvar() {
    if (!vendedor) {
      toast.error("Selecione o vendedor.");
      return;
    }
    const [ano, m] = mes.split("-").map(Number);
    start(async () => {
      const res = await saveMetaVendedor({
        ano,
        mes: m,
        vendedor_id: vendedor,
        representada_id: rep,
        valor_meta: valor || "0",
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Meta salva.");
        setValor("");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <FormGrid>
        <Field label="Vendedor">
          <Select value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mês">
          <Select value={mes} onChange={(e) => setMes(e.target.value)}>
            {opcoesMes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Representada (opcional)" hint="Em branco = meta geral do vendedor">
          <Select value={rep} onChange={(e) => setRep(e.target.value)}>
            <option value="">Todas</option>
            {representadas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Meta (R$)"
          hint={atual != null ? `Meta atual: ${formatBRL(atual)}` : undefined}
        >
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder={atual != null ? String(atual) : "0,00"}
          />
        </Field>
      </FormGrid>
      <div className="mt-4">
        <Button type="button" onClick={salvar} loading={pending}>
          Salvar meta do vendedor
        </Button>
      </div>
    </div>
  );
}
