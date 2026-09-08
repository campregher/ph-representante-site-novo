"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { tabelaSchema, type TabelaInput } from "@/lib/sistema/schemas";
import { saveTabela } from "@/lib/sistema/actions/tabelas";
import { TIPO_TABELA_OPTIONS, type TabelaPreco } from "@/lib/sistema/types";
import { Field, Input, Textarea, Select, Checkbox, FormGrid } from "@/components/sistema/ui/Field";
import { Card, CardBody, CardHeader } from "@/components/sistema/ui/Card";
import FormActions from "@/components/sistema/FormActions";

export default function TabelaForm({
  initial,
  representadaOptions,
  lockRepresentada,
}: {
  initial?: TabelaPreco;
  representadaOptions: { id: string; label: string }[];
  lockRepresentada?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TabelaInput>({
    resolver: zodResolver(tabelaSchema),
    defaultValues: initial
      ? {
          representada_id: initial.representada_id,
          nome: initial.nome,
          descricao: initial.descricao ?? "",
          tipo: initial.tipo ?? "",
          desconto_percentual:
            initial.desconto_percentual != null
              ? String(initial.desconto_percentual).replace(".", ",")
              : "0",
          data_inicio: initial.data_inicio ?? "",
          data_fim: initial.data_fim ?? "",
          ativa: initial.ativa,
        }
      : { representada_id: lockRepresentada ?? "", ativa: true, desconto_percentual: "0" },
  });

  function onSubmit(values: TabelaInput) {
    startTransition(async () => {
      const res = await saveTabela(initial?.id ?? null, values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(initial ? "Tabela atualizada." : "Tabela criada.");
      router.push(`/sistema/tabelas/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader title="Dados da tabela" />
        <CardBody>
          <FormGrid>
            <Field label="Representada" required error={errors.representada_id?.message}>
              <Select {...register("representada_id")} disabled={!!lockRepresentada || !!initial}>
                <option value="">Selecione…</option>
                {representadaOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nome" required error={errors.nome?.message}>
              <Input {...register("nome")} placeholder="ex.: Tabela Distribuidor" />
            </Field>
            <Field label="Tipo" error={errors.tipo?.message}>
              <Select {...register("tipo")}>
                <option value="">—</option>
                {TIPO_TABELA_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Desconto sobre o preço bruto (%)"
              error={errors.desconto_percentual?.message}
              hint="Preço da tabela = preço bruto − este desconto. Aceita vírgula ou ponto (ex.: 12,5)."
            >
              <Input
                {...register("desconto_percentual")}
                type="text"
                inputMode="decimal"
                placeholder="ex.: 12,5"
              />
            </Field>
            <Field
              label="Início da vigência"
              error={errors.data_inicio?.message}
              hint="Opcional."
            >
              <Input {...register("data_inicio")} type="date" />
            </Field>
            <Field
              label="Fim da vigência"
              error={errors.data_fim?.message}
              hint="Deixe em branco para vigência sem prazo de fim."
            >
              <Input {...register("data_fim")} type="date" />
            </Field>
          </FormGrid>
          <Field label="Descrição" error={errors.descricao?.message} className="mt-4">
            <Textarea {...register("descricao")} />
          </Field>
          <div className="mt-4">
            <Checkbox {...register("ativa")} label="Tabela ativa" />
          </div>
        </CardBody>
      </Card>
      <FormActions submitLabel={initial ? "Salvar alterações" : "Criar tabela"} loading={pending} />
    </form>
  );
}
