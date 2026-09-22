"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Field, Input } from "@/components/sistema/ui/Field";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";

export default function AlterarSenhaForm() {
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSalvando(true);
    const { error } = await createClient().auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSenha("");
    setConfirmar("");
    toast.success("Senha alterada.");
  }

  return (
    <Card>
      <CardHeader title="Trocar senha" />
      <CardBody>
        <form onSubmit={onSubmit} className="max-w-sm space-y-3">
          <Field label="Nova senha">
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirmar nova senha">
            <Input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" />
          </Field>
          <Button type="submit" loading={salvando}>
            Salvar senha
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
