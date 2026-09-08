"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { meuPerfilSchema } from "@/lib/sistema/schemas";
import { saveMeuPerfil } from "@/lib/sistema/actions/config";
import { Field, Input, FormGrid } from "@/components/sistema/ui/Field";
import { Button } from "@/components/sistema/ui/Button";

type Values = z.input<typeof meuPerfilSchema>;

export default function MeuPerfilForm({
  initial,
}: {
  initial: { nome: string; telefone: string; email: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(meuPerfilSchema),
    defaultValues: { nome: initial.nome, telefone: initial.telefone },
  });

  function onSubmit(v: Values) {
    start(async () => {
      const res = await saveMeuPerfil(v);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Perfil atualizado.");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormGrid>
        <Field label="Nome" required error={errors.nome?.message}>
          <Input {...register("nome")} />
        </Field>
        <Field label="Telefone" error={errors.telefone?.message}>
          <Input {...register("telefone")} inputMode="tel" placeholder="(11) 99999-9999" />
        </Field>
        <Field label="E-mail (login)">
          <Input value={initial.email} disabled />
        </Field>
      </FormGrid>
      <div className="mt-4">
        <Button type="submit" loading={pending} disabled={!isDirty}>
          Salvar perfil
        </Button>
      </div>
    </form>
  );
}
