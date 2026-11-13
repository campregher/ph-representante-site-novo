"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight, ArrowLeft, Lock } from "lucide-react";
import { sellerCadastroSchema, type SellerCadastroInput } from "@/lib/sistema/schemas";
import { cadastrarSeller } from "@/lib/sistema/actions/seller-cadastro";
import { UF_LIST } from "@/lib/sistema/types";
import { Field, Input, Select, FormGrid } from "@/components/sistema/ui/Field";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import AuthCard from "@/components/sistema/AuthCard";
import CnpjLookup from "@/components/sistema/CnpjLookup";
import type { CnpjData } from "@/lib/sistema/cnpj";
import type { CepData } from "@/lib/sistema/cep";

const ETAPAS = ["Identificação", "Contato", "Acesso ao portal", "Endereço"] as const;

const CAMPOS_POR_ETAPA: (keyof SellerCadastroInput)[][] = [
  ["cnpj", "inscricao_estadual", "razao_social", "nome_fantasia"],
  ["telefone", "whatsapp", "email"],
  ["senha", "confirmar_senha"],
  ["cep", "logradouro", "numero", "complemento", "bairro", "cidade", "estado"],
];

export default function SellerCadastroForm() {
  const [etapa, setEtapa] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [feito, setFeito] = useState<{ jaExistia: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    trigger,
    setError,
    formState: { errors },
  } = useForm<SellerCadastroInput>({
    resolver: zodResolver(sellerCadastroSchema),
  });

  const cnpjValue = (useWatch({ control, name: "cnpj" }) ?? "") as string;
  const wpp = (useWatch({ control, name: "whatsapp" }) ?? "") as string;

  function fillFromCep(d: CepData) {
    const set = (k: keyof SellerCadastroInput, v: string) => {
      if (v) setValue(k, v, { shouldDirty: true });
    };
    set("logradouro", d.logradouro);
    set("complemento", d.complemento);
    set("bairro", d.bairro);
    set("cidade", d.cidade);
    set("estado", d.estado);
  }

  async function buscarCepAoSair(valor: string) {
    const clean = valor.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`/api/drop/cep/${clean}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Falha na consulta do CEP.");
        return;
      }
      fillFromCep(json as CepData);
    } catch {
      toast.error("Erro de rede ao consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

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

  async function avancar() {
    const ok = await trigger(CAMPOS_POR_ETAPA[etapa]);
    if (!ok) return;

    // Regras que no schema completo são `.refine()` no nível do objeto —
    // o trigger() parcial do RHF não as reavalia por campo, então checa à mão.
    const v = getValues();
    if (etapa === 0) {
      if (!v.cnpj?.trim()) {
        setError("cnpj", { type: "manual", message: "Informe o CNPJ" });
        return;
      }
      if (!v.razao_social?.trim() && !v.nome_fantasia?.trim()) {
        setError("razao_social", { type: "manual", message: "Informe a razão social ou o nome" });
        return;
      }
    }
    if (etapa === 2 && v.senha !== v.confirmar_senha) {
      setError("confirmar_senha", { type: "manual", message: "As senhas não conferem" });
      return;
    }

    setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1));
  }

  function voltar() {
    setEtapa((e) => Math.max(e - 1, 0));
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
      <AuthCard
        title={feito.jaExistia ? "Você já está cadastrado!" : "Cadastro recebido!"}
        subtitle={
          feito.jaExistia
            ? "Encontramos um cadastro com esse documento — já está marcado como seller. Em breve nosso time entra em contato."
            : "Recebemos seus dados. Nosso time vai analisar e entrar em contato em breve para liberar seu acesso ao catálogo de dropshipping."
        }
        visual
      >
        <CheckCircle2 size={36} className="mx-auto text-green-600" />
      </AuthCard>
    );
  }

  const ultimaEtapa = etapa === ETAPAS.length - 1;

  return (
    <AuthCard
      title="Seja um seller PH Representante"
      subtitle="Cadastre sua empresa para vender nossos produtos por dropshipping."
      maxWidthClassName="max-w-2xl"
      visual
      semCnpjCta
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Indicador de progresso */}
        <div className="flex items-center gap-2">
          {ETAPAS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i < etapa
                    ? "bg-brand text-white"
                    : i === etapa
                      ? "border-2 border-brand text-brand"
                      : "border border-neutral-300 text-neutral-400"
                }`}
              >
                {i + 1}
              </div>
              {i < ETAPAS.length - 1 && (
                <div className={`h-0.5 flex-1 ${i < etapa ? "bg-brand" : "bg-neutral-200"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Passo {etapa + 1} de {ETAPAS.length} · {ETAPAS[etapa]}
        </p>

        {etapa === 0 && (
          <Card>
            <CardHeader title="Identificação" />
            <CardBody>
              <FormGrid>
                <Field label="CNPJ" required error={errors.cnpj?.message} className="sm:col-span-2">
                  <div className="flex gap-2">
                    <Input {...register("cnpj")} inputMode="numeric" placeholder="00.000.000/0000-00" className="flex-1 min-w-0" />
                    <div className="shrink-0">
                      <CnpjLookup cnpj={cnpjValue} onData={fillFromCnpj} endpoint="/api/drop/cnpj" />
                    </div>
                  </div>
                </Field>
                <Field label="Inscrição estadual" error={errors.inscricao_estadual?.message}>
                  <Input {...register("inscricao_estadual")} />
                </Field>
                <Field
                  label="Razão social"
                  required
                  error={errors.razao_social?.message}
                  className="sm:col-span-2"
                >
                  <Input {...register("razao_social")} />
                </Field>
                <Field label="Nome fantasia" error={errors.nome_fantasia?.message}>
                  <Input {...register("nome_fantasia")} />
                </Field>
              </FormGrid>
            </CardBody>
          </Card>
        )}

        {etapa === 1 && (
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
                <Field label="E-mail" required error={errors.email?.message} className="sm:col-span-2">
                  <Input {...register("email")} type="email" />
                </Field>
              </FormGrid>
            </CardBody>
          </Card>
        )}

        {etapa === 2 && (
          <Card>
            <CardHeader title="Acesso ao portal" />
            <CardBody>
              <FormGrid>
                <Field label="Senha" required error={errors.senha?.message}>
                  <div className="relative">
                    <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <Input {...register("senha")} type="password" autoComplete="new-password" className="pl-9" />
                  </div>
                </Field>
                <Field label="Confirmar senha" required error={errors.confirmar_senha?.message}>
                  <div className="relative">
                    <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <Input {...register("confirmar_senha")} type="password" autoComplete="new-password" className="pl-9" />
                  </div>
                </Field>
              </FormGrid>
            </CardBody>
          </Card>
        )}

        {etapa === 3 && (
          <Card>
            <CardHeader title="Endereço" />
            <CardBody>
              <FormGrid>
                <Field
                  label="CEP"
                  error={errors.cep?.message}
                  hint={buscandoCep ? "Buscando endereço…" : undefined}
                >
                  <Input
                    {...register("cep", { onBlur: (e) => buscarCepAoSair(e.target.value) })}
                    inputMode="numeric"
                    placeholder="00000-000"
                  />
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
        )}

        <div className="flex gap-3">
          {etapa > 0 && (
            <Button type="button" variant="outline" onClick={voltar} className="flex-1">
              <ArrowLeft size={15} /> Voltar
            </Button>
          )}
          {ultimaEtapa ? (
            <Button type="submit" loading={enviando} className="flex-1">
              Enviar cadastro <ArrowRight size={15} />
            </Button>
          ) : (
            <Button type="button" onClick={avancar} className="flex-1">
              Continuar <ArrowRight size={15} />
            </Button>
          )}
        </div>
      </form>
    </AuthCard>
  );
}
