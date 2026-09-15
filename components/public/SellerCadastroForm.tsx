"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { sellerCadastroSchema, type SellerCadastroInput } from "@/lib/sistema/schemas";
import { cadastrarSeller } from "@/lib/sistema/actions/seller-cadastro";
import { UF_LIST } from "@/lib/sistema/types";
import { Field, Input, Select, FormGrid } from "@/components/sistema/ui/Field";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import CnpjLookup from "@/components/sistema/CnpjLookup";
import type { CnpjData } from "@/lib/sistema/cnpj";

export default function SellerCadastroForm() {
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<{ jaExistia: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<SellerCadastroInput>({
    resolver: zodResolver(sellerCadastroSchema),
    defaultValues: { tipo_pessoa: "juridica" },
  });

  const tipo = (useWatch({ control, name: "tipo_pessoa" }) ?? "juridica") as string;
  const cnpjValue = (useWatch({ control, name: "cnpj" }) ?? "") as string;
  const wpp = (useWatch({ control, name: "whatsapp" }) ?? "") as string;
  const isPJ = tipo !== "fisica";

  function fillFromCnpj(d: CnpjData) {
    const set = (k: keyof SellerCadastroInput, v: string) => {
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

  async function onSubmit(values: SellerCadastroInput) {
    setEnviando(true);
    const res = await cadastrarSeller(values);
    setEnviando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setFeito({ jaExistia: !!res.jaExistia });
  }

  if (feito) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 size={40} className="mx-auto mb-4 text-green-600" />
        <h1 className="text-lg font-bold text-neutral-900">
          {feito.jaExistia ? "Você já está cadastrado!" : "Cadastro recebido!"}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {feito.jaExistia
            ? "Encontramos um cadastro com esse documento — já está marcado como seller. Em breve nosso time entra em contato."
            : "Recebemos seus dados. Nosso time vai analisar e entrar em contato em breve para liberar seu acesso ao catálogo de dropshipping."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <span className="text-2xl font-black tracking-tight text-neutral-900">PH</span>
        <h1 className="mt-3 text-xl font-bold text-neutral-900">Seja um seller PH Representante</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cadastre sua empresa para vender nossos produtos por dropshipping.
        </p>
      </div>

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

              {isPJ ? (
                <>
                  <Field label="CNPJ" error={errors.cnpj?.message}>
                    <div className="flex gap-2">
                      <Input {...register("cnpj")} inputMode="numeric" placeholder="00.000.000/0000-00" />
                      <CnpjLookup cnpj={cnpjValue} onData={fillFromCnpj} endpoint="/api/drop/cnpj" />
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
                </>
              )}
            </FormGrid>
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
              <Field label="E-mail" error={errors.email?.message} className="sm:col-span-2">
                <Input {...register("email")} type="email" />
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
          </CardBody>
        </Card>

        <Button type="submit" loading={enviando} className="w-full">
          Enviar cadastro
        </Button>
      </form>
    </div>
  );
}
