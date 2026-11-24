"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, Check, ArrowRight, ArrowLeft, Lock, ShieldAlert, ShieldCheck, Info } from "lucide-react";
import { sellerCadastroSchema, type SellerCadastroInput } from "@/lib/sistema/schemas";
import { cadastrarSeller, verificarCnpjCadastro, type CnpjCadastroStatus } from "@/lib/sistema/actions/seller-cadastro";
import { enviarCodigoWhatsapp, confirmarCodigoWhatsapp } from "@/lib/sistema/actions/whatsapp-verificacao";
import { UF_LIST } from "@/lib/sistema/types";
import { Field, Input, Select, FormGrid, Checkbox } from "@/components/sistema/ui/Field";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import { Note } from "@/components/sistema/ui/Note";
import AuthCard from "@/components/sistema/AuthCard";
import CnpjLookup from "@/components/sistema/CnpjLookup";
import type { CnpjData } from "@/lib/sistema/cnpj";
import type { CepData } from "@/lib/sistema/cep";
import { CNAES_SELLER_PERMITIDOS, cnaeSellerPermitido, formatarCnae } from "@/lib/sistema/seller-cnae";

const ETAPAS = ["Identificação", "Contato", "Acesso ao portal", "Endereço"] as const;
/** Rótulos curtos pro indicador de progresso — a etapa completa aparece no
 *  título do card logo abaixo, então aqui só precisa caber sob o marcador. */
const ETAPAS_CURTAS = ["CNPJ", "Contato", "Acesso", "Endereço"] as const;

const CAMPOS_POR_ETAPA: (keyof SellerCadastroInput)[][] = [
  ["cnpj", "inscricao_estadual", "razao_social", "nome_fantasia"],
  ["telefone", "whatsapp", "email"],
  ["senha", "confirmar_senha"],
  ["cep", "logradouro", "numero", "complemento", "bairro", "cidade", "estado"],
];

export default function SellerCadastroForm({ cnaeDesativado = false }: { cnaeDesativado?: boolean }) {
  const [etapa, setEtapa] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [feito, setFeito] = useState<{ jaExistia: boolean } | null>(null);
  const [isento, setIsento] = useState(false);
  const [cnaeInfo, setCnaeInfo] = useState<{ codigo: string; texto: string; permitido: boolean } | null>(null);
  const [cnpjStatus, setCnpjStatus] = useState<CnpjCadastroStatus | null>(null);
  const [verificandoCnpj, setVerificandoCnpj] = useState(false);
  const [wppCodigoEnviado, setWppCodigoEnviado] = useState(false);
  const [wppVerificadoPara, setWppVerificadoPara] = useState<string | null>(null);
  const [wppCodigoInput, setWppCodigoInput] = useState("");
  const [enviandoCodigoWpp, setEnviandoCodigoWpp] = useState(false);
  const [confirmandoCodigoWpp, setConfirmandoCodigoWpp] = useState(false);

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

  async function verificarCnpjAoSair(valor: string) {
    const clean = valor.replace(/\D/g, "");
    if (clean.length !== 14) {
      setCnpjStatus(null);
      return;
    }
    setVerificandoCnpj(true);
    try {
      const res = await verificarCnpjCadastro(clean);
      setCnpjStatus(res.status);
    } catch {
      setCnpjStatus(null);
    } finally {
      setVerificandoCnpj(false);
    }
  }

  async function enviarCodigoWpp() {
    if (!wpp?.trim()) {
      toast.error("Informe o WhatsApp primeiro.");
      return;
    }
    setEnviandoCodigoWpp(true);
    const res = await enviarCodigoWhatsapp(wpp);
    setEnviandoCodigoWpp(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setWppCodigoEnviado(true);
    toast.success("Código enviado por WhatsApp.");
  }

  async function confirmarCodigoWpp() {
    setConfirmandoCodigoWpp(true);
    const res = await confirmarCodigoWhatsapp(wpp, wppCodigoInput);
    setConfirmandoCodigoWpp(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setWppVerificadoPara(wpp);
    setWppCodigoEnviado(false);
    setWppCodigoInput("");
    toast.success("WhatsApp verificado!");
  }

  function fillFromCnpj(d: CnpjData) {
    const set = (k: keyof SellerCadastroInput, v: string) => {
      if (v) setValue(k, v, { shouldDirty: true });
    };
    set("razao_social", d.razao_social);
    set("nome_fantasia", d.nome_fantasia);
    if (d.inscricao_estadual) {
      set("inscricao_estadual", d.inscricao_estadual);
      setIsento(false);
    }
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

    setCnaeInfo(
      d.cnae_principal
        ? {
            codigo: d.cnae_principal,
            texto: d.cnae_principal_texto,
            permitido: cnaeSellerPermitido(d.cnae_principal, d.cnaes_secundarios),
          }
        : null
    );
    verificarCnpjAoSair(cnpjValue);
  }

  function toggleIsento(checked: boolean) {
    setIsento(checked);
    setValue("inscricao_estadual", checked ? "ISENTO" : "", { shouldDirty: true, shouldValidate: true });
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
      if (!v.inscricao_estadual?.trim()) {
        setError("inscricao_estadual", { type: "manual", message: 'Informe a Inscrição Estadual (ou marque "Isento")' });
        return;
      }
      if (!v.razao_social?.trim() && !v.nome_fantasia?.trim()) {
        setError("razao_social", { type: "manual", message: "Informe a razão social ou o nome" });
        return;
      }
      if (!cnaeDesativado && cnaeInfo && !cnaeInfo.permitido) {
        setError("cnpj", {
          type: "manual",
          message: "Este CNAE não é aceito — veja o aviso abaixo do campo CNPJ.",
        });
        return;
      }
      if (cnpjStatus === "seller") {
        setError("cnpj", {
          type: "manual",
          message: "Este CNPJ já tem cadastro de seller — veja o aviso abaixo do campo CNPJ.",
        });
        return;
      }
    }
    if (etapa === 1) {
      if (!v.whatsapp?.trim()) {
        setError("whatsapp", { type: "manual", message: "Informe o WhatsApp e confirme o código de verificação" });
        return;
      }
      if (wppVerificadoPara !== v.whatsapp) {
        setError("whatsapp", {
          type: "manual",
          message: "Confirme o código enviado por WhatsApp antes de continuar.",
        });
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
        <CheckCircle2 size={36} className="mx-auto text-success" />
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Indicador de progresso — ecoa o RouteRail do site (marcador +
            conector pontilhado): mesma assinatura visual, agora como
            checkpoints de aprovação em vez de elos da cadeia de venda. */}
        <div className="flex items-start">
          {ETAPAS_CURTAS.map((label, i) => {
            const feito = i < etapa;
            const atual = i === etapa;
            return (
              <div key={label} className="flex items-center" style={{ flex: i < ETAPAS.length - 1 ? "1 1 auto" : "0 0 auto" }}>
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[11px] font-bold transition-colors ${
                      feito
                        ? "bg-brand text-white"
                        : atual
                          ? "border-2 border-brand text-brand"
                          : "border border-neutral-300 text-neutral-300"
                    }`}
                  >
                    {feito ? <Check size={13} strokeWidth={3} /> : i + 1}
                  </span>
                  <span
                    className={`text-[9px] font-mono uppercase tracking-wide ${
                      atual ? "font-semibold text-brand" : feito ? "text-neutral-500" : "text-neutral-300"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < ETAPAS.length - 1 && (
                  <span
                    aria-hidden
                    className="mx-1.5 mb-4 h-[2px] flex-1"
                    style={{
                      backgroundImage: `linear-gradient(to right, ${feito ? "var(--color-brand)" : "var(--color-neutral-300)"} 0 5px, transparent 5px 9px)`,
                      backgroundSize: "9px 2px",
                      backgroundRepeat: "repeat-x",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
        {etapa === 0 && (
          <motion.div key={0} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
          <Card>
            <CardHeader title="Identificação" />
            <CardBody>
              <Note tone="info" icon={<ShieldAlert size={15} />} className="mb-4">
                Só aceitamos CNPJs com CNAE de comércio de peças e acessórios automotivos —{" "}
                {Object.keys(CNAES_SELLER_PERMITIDOS)
                  .map((c) => formatarCnae(c))
                  .map((c, i, arr) => (
                    <span key={c}>
                      <strong>{c}</strong>
                      {i < arr.length - 1 ? " ou " : ""}
                    </span>
                  ))}
                . É uma exigência dos nossos fornecedores pra liberar o dropshipping.
              </Note>
              <FormGrid>
                <Field label="CNPJ" required error={errors.cnpj?.message} className="sm:col-span-2">
                  {/* empilha no mobile — lado a lado, o botão "Puxar da Receita"
                      (texto longo) espremia o campo de CNPJ a ~74px de largura,
                      cortando o placeholder (confirmado ao vivo em 375px). */}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      {...register("cnpj", { onBlur: (e) => verificarCnpjAoSair(e.target.value) })}
                      inputMode="numeric"
                      placeholder="00.000.000/0000-00"
                      className="flex-1 min-w-0"
                    />
                    <div className="shrink-0">
                      <CnpjLookup cnpj={cnpjValue} onData={fillFromCnpj} endpoint="/api/drop/cnpj" />
                    </div>
                  </div>
                  {cnaeInfo && (
                    <Note
                      tone={cnaeInfo.permitido ? "success" : "danger"}
                      icon={cnaeInfo.permitido ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
                      className="mt-2"
                    >
                      CNAE encontrado: <strong>{formatarCnae(cnaeInfo.codigo)}</strong> — {cnaeInfo.texto || "sem descrição"}.{" "}
                      {cnaeInfo.permitido
                        ? "Habilitado para cadastro de seller."
                        : "Este CNAE não é de peças/acessórios automotivos — não é possível prosseguir com este CNPJ."}
                    </Note>
                  )}
                  {verificandoCnpj && <p className="mt-2 text-xs text-neutral-400">Verificando CNPJ…</p>}
                  {!verificandoCnpj && cnpjStatus === "seller" && (
                    <Note tone="danger" icon={<ShieldAlert size={15} />} className="mt-2">
                      <p>Este CNPJ já tem cadastro de seller — não é possível criar outro. Acesse sua conta ou recupere a senha.</p>
                      <div className="mt-2.5 flex gap-2">
                        <Link
                          href="/drop/login"
                          className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                        >
                          Acessar minha conta
                        </Link>
                        <Link
                          href="/recuperar-senha"
                          className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50"
                        >
                          Recuperar senha
                        </Link>
                      </div>
                    </Note>
                  )}
                  {!verificandoCnpj && cnpjStatus === "cliente" && (
                    <Note tone="info" icon={<Info size={15} />} className="mt-2">
                      Este CNPJ já é cliente PH — seu cadastro será vinculado automaticamente, sem esperar aprovação.
                    </Note>
                  )}
                </Field>
                <Field label="Inscrição estadual" required error={errors.inscricao_estadual?.message}>
                  <Input {...register("inscricao_estadual")} disabled={isento} placeholder={isento ? "ISENTO" : undefined} />
                  <Checkbox
                    label="Isento de Inscrição Estadual"
                    checked={isento}
                    onChange={(e) => toggleIsento(e.target.checked)}
                    className="mt-1.5"
                  />
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
          </motion.div>
        )}

        {etapa === 1 && (
          <motion.div key={1} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
          <Card>
            <CardHeader title="Contato" />
            <CardBody>
              <FormGrid>
                <Field label="Telefone" error={errors.telefone?.message}>
                  <Input {...register("telefone")} inputMode="tel" />
                </Field>
                <Field label="WhatsApp" required error={errors.whatsapp?.message} className="sm:col-span-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      {...register("whatsapp")}
                      inputMode="tel"
                      placeholder="(11) 99999-9999"
                      className="flex-1 min-w-0"
                      disabled={wppVerificadoPara === wpp && !!wpp?.trim()}
                    />
                    {wppVerificadoPara === wpp && !!wpp?.trim() ? (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-success/10 px-3 py-2 text-xs font-semibold text-success">
                        <ShieldCheck size={14} /> Verificado
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={enviarCodigoWpp}
                        loading={enviandoCodigoWpp}
                        className="shrink-0"
                      >
                        {wppCodigoEnviado ? "Reenviar código" : "Verificar WhatsApp"}
                      </Button>
                    )}
                  </div>
                  {wppCodigoEnviado && wppVerificadoPara !== wpp && (
                    <div className="mt-2 rounded-lg bg-info/5 p-2.5">
                      <p className="mb-2 text-xs text-neutral-500">Enviamos um código de 6 dígitos pra esse WhatsApp.</p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          value={wppCodigoInput}
                          onChange={(e) => setWppCodigoInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          inputMode="numeric"
                          placeholder="Código de 6 dígitos"
                          className="sm:max-w-[160px]"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={confirmarCodigoWpp}
                          loading={confirmandoCodigoWpp}
                          disabled={wppCodigoInput.length !== 6}
                        >
                          Confirmar código
                        </Button>
                      </div>
                    </div>
                  )}
                </Field>
                <Field label="E-mail" required error={errors.email?.message} className="sm:col-span-2">
                  <Input {...register("email")} type="email" />
                </Field>
              </FormGrid>
            </CardBody>
          </Card>
          </motion.div>
        )}

        {etapa === 2 && (
          <motion.div key={2} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
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
          </motion.div>
        )}

        {etapa === 3 && (
          <motion.div key={3} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
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
          </motion.div>
        )}
        </AnimatePresence>

        {etapa === 1 && wpp?.trim() && wppVerificadoPara !== wpp && (
          <p className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Lock size={12} /> Confirme o código de verificação pra continuar.
          </p>
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
            <Button
              type="button"
              onClick={avancar}
              disabled={
                (etapa === 0 && (cnpjStatus === "seller" || (!cnaeDesativado && !!cnaeInfo && !cnaeInfo.permitido))) ||
                (etapa === 1 && (!wpp?.trim() || wppVerificadoPara !== wpp))
              }
              className="flex-1"
            >
              Continuar <ArrowRight size={15} />
            </Button>
          )}
        </div>
      </form>
    </AuthCard>
  );
}
