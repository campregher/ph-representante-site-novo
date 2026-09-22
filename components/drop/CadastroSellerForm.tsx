"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { atualizarMeuCadastro, type MeuCadastroInput } from "@/lib/sistema/actions/seller-conta";
import { UF_LIST } from "@/lib/sistema/types";
import { Field, Input, Select, FormGrid } from "@/components/sistema/ui/Field";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";

export default function CadastroSellerForm({ initial }: { initial: MeuCadastroInput }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [salvando, setSalvando] = useState(false);

  function set<K extends keyof MeuCadastroInput>(k: K, v: MeuCadastroInput[K]) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const res = await atualizarMeuCadastro(values);
    setSalvando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Cadastro atualizado.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader title="Identificação" description="CNPJ/CPF e e-mail não podem ser alterados aqui — fale com a gente se precisar." />
        <CardBody>
          <FormGrid>
            <Field label="Razão social / Nome" className="sm:col-span-2">
              <Input value={values.razao_social} onChange={(e) => set("razao_social", e.target.value)} />
            </Field>
            <Field label="Nome fantasia">
              <Input value={values.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} />
            </Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contato" />
        <CardBody>
          <FormGrid>
            <Field label="Telefone">
              <Input value={values.telefone} onChange={(e) => set("telefone", e.target.value)} inputMode="tel" />
            </Field>
            <Field label="WhatsApp">
              <Input value={values.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" />
            </Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Endereço" />
        <CardBody>
          <FormGrid>
            <Field label="CEP">
              <Input value={values.cep} onChange={(e) => set("cep", e.target.value)} inputMode="numeric" placeholder="00000-000" />
            </Field>
            <Field label="Logradouro">
              <Input value={values.logradouro} onChange={(e) => set("logradouro", e.target.value)} />
            </Field>
            <Field label="Número">
              <Input value={values.numero} onChange={(e) => set("numero", e.target.value)} />
            </Field>
            <Field label="Complemento">
              <Input value={values.complemento} onChange={(e) => set("complemento", e.target.value)} />
            </Field>
            <Field label="Bairro">
              <Input value={values.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </Field>
            <Field label="Cidade">
              <Input value={values.cidade} onChange={(e) => set("cidade", e.target.value)} />
            </Field>
            <Field label="UF">
              <Select value={values.estado} onChange={(e) => set("estado", e.target.value)}>
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

      <Button type="submit" loading={salvando}>
        Salvar alterações
      </Button>
    </form>
  );
}
