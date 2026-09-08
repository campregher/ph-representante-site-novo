"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { empresaConfigSchema } from "@/lib/sistema/schemas";
import { saveEmpresaConfig } from "@/lib/sistema/actions/config";
import type { EmpresaConfig } from "@/lib/sistema/config";
import { Field, Input, Textarea, FormGrid } from "@/components/sistema/ui/Field";
import { Button } from "@/components/sistema/ui/Button";

type Values = z.input<typeof empresaConfigSchema>;

export default function EmpresaConfigForm({ initial }: { initial: EmpresaConfig }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(empresaConfigSchema),
    defaultValues: {
      empresa_nome: initial.empresa_nome,
      whatsapp: initial.whatsapp ?? "",
      telefone: initial.telefone ?? "",
      email: initial.email ?? "",
      cnpj: initial.cnpj ?? "",
      endereco: initial.endereco ?? "",
      cidade: initial.cidade ?? "",
      site: initial.site ?? "",
      observacoes_padrao_pedido: initial.observacoes_padrao_pedido ?? "",
    },
  });

  function onSubmit(v: Values) {
    start(async () => {
      const res = await saveEmpresaConfig(v);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Dados da empresa atualizados.");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormGrid>
        <Field label="Nome da empresa" required error={errors.empresa_nome?.message} className="sm:col-span-2">
          <Input {...register("empresa_nome")} />
        </Field>
        <Field label="WhatsApp" error={errors.whatsapp?.message} hint="Aparece no cabeçalho do pedido.">
          <Input {...register("whatsapp")} inputMode="tel" placeholder="(11) 99999-9999" />
        </Field>
        <Field label="Telefone" error={errors.telefone?.message}>
          <Input {...register("telefone")} inputMode="tel" />
        </Field>
        <Field label="E-mail" error={errors.email?.message}>
          <Input {...register("email")} type="email" />
        </Field>
        <Field label="CNPJ" error={errors.cnpj?.message}>
          <Input {...register("cnpj")} inputMode="numeric" />
        </Field>
        <Field label="Endereço" error={errors.endereco?.message} className="sm:col-span-2">
          <Input {...register("endereco")} />
        </Field>
        <Field label="Cidade / UF" error={errors.cidade?.message}>
          <Input {...register("cidade")} placeholder="São Paulo, SP" />
        </Field>
        <Field label="Site" error={errors.site?.message}>
          <Input {...register("site")} />
        </Field>
      </FormGrid>
      <Field
        label="Observação padrão do pedido"
        error={errors.observacoes_padrao_pedido?.message}
        hint="Texto opcional para novos pedidos (ex.: prazo, política de troca)."
        className="mt-4"
      >
        <Textarea {...register("observacoes_padrao_pedido")} />
      </Field>
      <div className="mt-4">
        <Button type="submit" loading={pending} disabled={!isDirty}>
          Salvar dados da empresa
        </Button>
      </div>
    </form>
  );
}
