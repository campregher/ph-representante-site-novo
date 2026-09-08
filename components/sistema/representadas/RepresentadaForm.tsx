"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { representadaSchema, type RepresentadaInput } from "@/lib/sistema/schemas";
import { saveRepresentada } from "@/lib/sistema/actions/representadas";
import {
  MODALIDADE_OPTIONS,
  DROPSHIP_FATURAMENTO_OPTIONS,
  DROPSHIP_PAGAMENTO_OPTIONS,
  type Representada,
} from "@/lib/sistema/types";
import { Field, Input, Textarea, Select, Checkbox, FormGrid } from "@/components/sistema/ui/Field";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import FormActions from "@/components/sistema/FormActions";
import CnpjLookup from "@/components/sistema/CnpjLookup";
import LogoUpload from "@/components/sistema/LogoUpload";
import type { CnpjData } from "@/lib/sistema/cnpj";

export default function RepresentadaForm({ initial }: { initial?: Representada }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<RepresentadaInput>({
    resolver: zodResolver(representadaSchema),
    defaultValues: initial
      ? {
          razao_social: initial.razao_social,
          nome_fantasia: initial.nome_fantasia ?? "",
          cnpj: initial.cnpj ?? "",
          inscricao_estadual: initial.inscricao_estadual ?? "",
          telefone: initial.telefone ?? "",
          whatsapp: initial.whatsapp ?? "",
          email: initial.email ?? "",
          site: initial.site ?? "",
          contato_comercial: initial.contato_comercial ?? "",
          contato_financeiro: initial.contato_financeiro ?? "",
          cep: initial.cep ?? "",
          logradouro: initial.logradouro ?? "",
          numero: initial.numero ?? "",
          complemento: initial.complemento ?? "",
          bairro: initial.bairro ?? "",
          cidade: initial.cidade ?? "",
          estado: initial.estado ?? "",
          pedido_minimo: initial.pedido_minimo ?? "",
          percentual_comissao_padrao:
            initial.percentual_comissao_padrao != null
              ? String(initial.percentual_comissao_padrao).replace(".", ",")
              : "",
          desconto_maximo_padrao:
            initial.desconto_maximo_padrao != null
              ? String(initial.desconto_maximo_padrao).replace(".", ",")
              : "",
          prazo_pagamento_padrao: initial.prazo_pagamento_padrao ?? "",
          prazo_entrega: initial.prazo_entrega ?? "",
          logo_url: initial.logo_url ?? "",
          observacoes: initial.observacoes ?? "",
          modalidades: initial.modalidades?.length ? initial.modalidades : ["atacado"],
          dropship_faturamento: initial.dropship_faturamento ?? "",
          dropship_condicoes_pagamento: initial.dropship_condicoes_pagamento ?? [],
          dropship_observacoes: initial.dropship_observacoes ?? "",
          ativa: initial.ativa,
        }
      : { ativa: true, modalidades: ["atacado"], dropship_condicoes_pagamento: [] },
  });

  const modalidades = (useWatch({ control, name: "modalidades" }) ?? []) as string[];
  const fazDropship = modalidades.includes("dropshipping");
  const cnpjValue = (useWatch({ control, name: "cnpj" }) ?? "") as string;
  const logoUrl = (useWatch({ control, name: "logo_url" }) ?? "") as string;
  const whatsappValue = (useWatch({ control, name: "whatsapp" }) ?? "") as string;

  function fillFromCnpj(d: CnpjData) {
    const set = (k: keyof RepresentadaInput, v: string) => {
      if (v) setValue(k, v, { shouldDirty: true, shouldValidate: false });
    };
    set("razao_social", d.razao_social);
    set("nome_fantasia", d.nome_fantasia);
    set("inscricao_estadual", d.inscricao_estadual);
    set("telefone", d.telefone);
    if (d.telefone && !whatsappValue) set("whatsapp", d.telefone);
    set("email", d.email);
    set("cep", d.cep);
    set("logradouro", d.logradouro);
    set("numero", d.numero);
    set("complemento", d.complemento);
    set("bairro", d.bairro);
    set("cidade", d.cidade);
    set("estado", d.estado);
  }

  function onSubmit(values: RepresentadaInput) {
    startTransition(async () => {
      const res = await saveRepresentada(initial?.id ?? null, values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(initial ? "Representada atualizada." : "Representada criada.");
      router.push(`/sistema/representadas/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader
          title="Dados cadastrais"
          description="Preencha o CNPJ e use “Puxar da Receita” para completar o resto."
        />
        <CardBody>
          <FormGrid>
            <Field label="CNPJ" error={errors.cnpj?.message}>
              <div className="flex gap-2">
                <Input {...register("cnpj")} placeholder="00.000.000/0000-00" inputMode="numeric" />
                <CnpjLookup cnpj={cnpjValue} onData={fillFromCnpj} />
              </div>
            </Field>
            <Field label="Inscrição estadual" error={errors.inscricao_estadual?.message}>
              <Input {...register("inscricao_estadual")} />
            </Field>
            <Field label="Razão social" required error={errors.razao_social?.message} className="sm:col-span-2">
              <Input {...register("razao_social")} />
            </Field>
            <Field label="Nome fantasia" error={errors.nome_fantasia?.message}>
              <Input {...register("nome_fantasia")} />
            </Field>
            <Field label="Telefone" error={errors.telefone?.message}>
              <Input {...register("telefone")} inputMode="tel" />
            </Field>
            <Field label="WhatsApp" error={errors.whatsapp?.message}>
              <Input {...register("whatsapp")} inputMode="tel" placeholder="(11) 99999-9999" />
            </Field>
            <Field label="E-mail" error={errors.email?.message}>
              <Input {...register("email")} type="email" />
            </Field>
            <Field label="Site" error={errors.site?.message}>
              <Input {...register("site")} placeholder="https://" />
            </Field>
            <Field label="Logo" error={errors.logo_url?.message} className="sm:col-span-2">
              <LogoUpload
                value={logoUrl}
                onChange={(v) => setValue("logo_url", v, { shouldDirty: true })}
              />
            </Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Modalidades de atendimento"
          description="Como esta representada trabalha com os clientes."
        />
        <CardBody>
          <div className="flex flex-wrap gap-4">
            {MODALIDADE_OPTIONS.map((m) => (
              <Checkbox
                key={m.value}
                value={m.value}
                {...register("modalidades")}
                label={m.label}
              />
            ))}
          </div>
          {errors.modalidades?.message && (
            <p className="mt-1 text-xs text-red-600">{errors.modalidades.message}</p>
          )}

          {fazDropship && (
            <div className="mt-5 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Opções do dropshipping
              </p>
              <FormGrid>
                <Field label="Frequência de faturamento" error={errors.dropship_faturamento?.message}>
                  <Select {...register("dropship_faturamento")}>
                    <option value="">—</option>
                    {DROPSHIP_FATURAMENTO_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FormGrid>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-neutral-600">
                  Condições de pagamento aceitas no dropship
                </p>
                <div className="flex flex-wrap gap-4">
                  {DROPSHIP_PAGAMENTO_OPTIONS.map((c) => (
                    <Checkbox
                      key={c}
                      value={c}
                      {...register("dropship_condicoes_pagamento")}
                      label={c}
                    />
                  ))}
                </div>
              </div>
              <Field label="Observações do dropship" error={errors.dropship_observacoes?.message}>
                <Textarea
                  {...register("dropship_observacoes")}
                  placeholder="Regras de etiqueta, ponto de coleta, prazos de postagem…"
                />
              </Field>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Pessoas de contato" />
        <CardBody>
          <FormGrid>
            <Field label="Contato comercial" error={errors.contato_comercial?.message}>
              <Input {...register("contato_comercial")} />
            </Field>
            <Field label="Contato financeiro" error={errors.contato_financeiro?.message}>
              <Input {...register("contato_financeiro")} />
            </Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Endereço" />
        <CardBody>
          <FormGrid>
            <Field label="CEP" error={errors.cep?.message}>
              <Input {...register("cep")} inputMode="numeric" placeholder="00000-000" />
            </Field>
            <Field label="Logradouro" error={errors.logradouro?.message}>
              <Input {...register("logradouro")} />
            </Field>
            <Field label="Número" error={errors.numero?.message}>
              <Input {...register("numero")} />
            </Field>
            <Field label="Complemento" error={errors.complemento?.message}>
              <Input {...register("complemento")} />
            </Field>
            <Field label="Bairro" error={errors.bairro?.message}>
              <Input {...register("bairro")} />
            </Field>
            <Field label="Cidade" error={errors.cidade?.message}>
              <Input {...register("cidade")} />
            </Field>
            <Field label="UF" error={errors.estado?.message}>
              <Input {...register("estado")} maxLength={2} className="uppercase" />
            </Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Condições comerciais padrão" />
        <CardBody>
          <FormGrid>
            <Field label="Pedido mínimo (R$)" error={errors.pedido_minimo?.message}>
              <Input {...register("pedido_minimo")} type="number" step="0.01" min="0" />
            </Field>
            <Field label="Comissão padrão (%)" error={errors.percentual_comissao_padrao?.message}>
              <Input
                {...register("percentual_comissao_padrao")}
                type="text"
                inputMode="decimal"
                placeholder="ex.: 5 ou 5,5"
              />
            </Field>
            <Field label="Desconto máximo padrão (%)" error={errors.desconto_maximo_padrao?.message}>
              <Input
                {...register("desconto_maximo_padrao")}
                type="text"
                inputMode="decimal"
                placeholder="ex.: 12 ou 12,5"
              />
            </Field>
            <Field label="Prazo de pagamento padrão" error={errors.prazo_pagamento_padrao?.message}>
              <Input {...register("prazo_pagamento_padrao")} placeholder="ex.: 28/35/42 dias" />
            </Field>
            <Field label="Prazo de entrega" error={errors.prazo_entrega?.message}>
              <Input {...register("prazo_entrega")} placeholder="ex.: 7 dias úteis" />
            </Field>
          </FormGrid>
          <Field label="Observações" error={errors.observacoes?.message} className="mt-4">
            <Textarea {...register("observacoes")} />
          </Field>
          <div className="mt-4">
            <Checkbox {...register("ativa")} label="Representada ativa" />
          </div>
        </CardBody>
      </Card>

      <FormActions
        submitLabel={initial ? "Salvar alterações" : "Criar representada"}
        loading={pending}
      />
    </form>
  );
}
