"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { clienteSchema, type ClienteInput } from "@/lib/sistema/schemas";
import { saveCliente } from "@/lib/sistema/actions/clientes";
import { CLIENTE_STATUS_OPTIONS, UF_LIST, type Cliente } from "@/lib/sistema/types";
import { Field, Input, Textarea, Select, FormGrid } from "@/components/sistema/ui/Field";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import FormActions from "@/components/sistema/FormActions";
import CnpjLookup from "@/components/sistema/CnpjLookup";
import type { CnpjData } from "@/lib/sistema/cnpj";

export default function ClienteForm({
  initial,
  vendedorOptions,
  lockVendedor,
}: {
  initial?: Cliente;
  vendedorOptions: { id: string; label: string }[];
  lockVendedor?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: initial
      ? {
          tipo_pessoa: initial.tipo_pessoa,
          cnpj: initial.cnpj ?? "",
          cpf: initial.cpf ?? "",
          razao_social: initial.razao_social ?? "",
          nome_fantasia: initial.nome_fantasia ?? "",
          inscricao_estadual: initial.inscricao_estadual ?? "",
          telefone: initial.telefone ?? "",
          whatsapp: initial.whatsapp ?? "",
          email: initial.email ?? "",
          site: initial.site ?? "",
          cep: initial.cep ?? "",
          logradouro: initial.logradouro ?? "",
          numero: initial.numero ?? "",
          complemento: initial.complemento ?? "",
          bairro: initial.bairro ?? "",
          cidade: initial.cidade ?? "",
          estado: initial.estado ?? "",
          vendedor_id: initial.vendedor_id ?? "",
          limite_credito: initial.limite_credito ?? "",
          status: initial.status,
          is_seller: initial.is_seller ?? false,
          observacoes: initial.observacoes ?? "",
        }
      : { tipo_pessoa: "juridica", status: "prospect", vendedor_id: "", is_seller: false },
  });

  const tipo = (useWatch({ control, name: "tipo_pessoa" }) ?? "juridica") as string;
  const cnpjValue = (useWatch({ control, name: "cnpj" }) ?? "") as string;
  const wpp = (useWatch({ control, name: "whatsapp" }) ?? "") as string;
  const isPJ = tipo !== "fisica";

  function fillFromCnpj(d: CnpjData) {
    const set = (k: keyof ClienteInput, v: string) => {
      if (v) setValue(k, v, { shouldDirty: true });
    };
    set("razao_social", d.razao_social);
    set("nome_fantasia", d.nome_fantasia);
    set("inscricao_estadual", d.inscricao_estadual);
    set("telefone", d.telefone);
    if (d.telefone && !wpp) set("whatsapp", d.telefone);
    set("email", d.email);
    set("cep", d.cep);
    set("logradouro", d.logradouro);
    set("numero", d.numero);
    set("complemento", d.complemento);
    set("bairro", d.bairro);
    set("cidade", d.cidade);
    set("estado", d.estado);
  }

  function onSubmit(values: ClienteInput) {
    startTransition(async () => {
      const res = await saveCliente(initial?.id ?? null, values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(initial ? "Cliente atualizado." : "Cliente criado.");
      router.push(`/sistema/clientes/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader title="Identificação" />
        <CardBody>
          <FormGrid>
            <Field label="Tipo de pessoa">
              <Select {...register("tipo_pessoa")}>
                <option value="juridica">Pessoa jurídica</option>
                <option value="fisica">Pessoa física</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select {...register("status")}>
                {CLIENTE_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>

            {isPJ ? (
              <>
                <Field label="CNPJ" error={errors.cnpj?.message}>
                  <div className="flex gap-2">
                    <Input {...register("cnpj")} inputMode="numeric" placeholder="00.000.000/0000-00" />
                    <CnpjLookup cnpj={cnpjValue} onData={fillFromCnpj} />
                  </div>
                </Field>
                <Field label="Inscrição estadual" error={errors.inscricao_estadual?.message}>
                  <Input {...register("inscricao_estadual")} />
                </Field>
                <Field
                  label="Razão social"
                  error={errors.razao_social?.message}
                  className="sm:col-span-2"
                >
                  <Input {...register("razao_social")} />
                </Field>
                <Field label="Nome fantasia" error={errors.nome_fantasia?.message}>
                  <Input {...register("nome_fantasia")} />
                </Field>
              </>
            ) : (
              <>
                <Field label="CPF" error={errors.cpf?.message}>
                  <Input {...register("cpf")} inputMode="numeric" placeholder="000.000.000-00" />
                </Field>
                <Field
                  label="Nome completo"
                  error={errors.razao_social?.message}
                  className="sm:col-span-2"
                >
                  <Input {...register("razao_social")} />
                </Field>
                <Field label="Apelido / referência" error={errors.nome_fantasia?.message}>
                  <Input {...register("nome_fantasia")} />
                </Field>
              </>
            )}

            <Field label="Vendedor responsável" error={errors.vendedor_id?.message}>
              <Select {...register("vendedor_id")} disabled={lockVendedor}>
                <option value="">— sem vendedor —</option>
                {vendedorOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Limite de crédito (R$)" error={errors.limite_credito?.message}>
              <Input {...register("limite_credito")} type="number" step="0.01" min="0" />
            </Field>
          </FormGrid>
          <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              {...register("is_seller")}
              className="h-4 w-4 rounded border-neutral-300 text-brand focus:ring-brand/30"
            />
            Seller (revendedor da linha própria — pode receber pedidos drop)
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contato" />
        <CardBody>
          <FormGrid>
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
              <Select {...register("estado")}>
                <option value="">—</option>
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            </Field>
          </FormGrid>
          <Field label="Observações" error={errors.observacoes?.message} className="mt-4">
            <Textarea {...register("observacoes")} />
          </Field>
        </CardBody>
      </Card>

      <FormActions submitLabel={initial ? "Salvar alterações" : "Criar cliente"} loading={pending} />
    </form>
  );
}
