"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { salvarProdutoProprio } from "@/lib/sistema/actions/linha-propria";
import { Card, CardBody, CardHeader } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, Textarea, Select, FormGrid } from "@/components/sistema/ui/Field";

interface Opt { id: string; label: string }

const base = {
  sku: "", nome: "", descricao: "", fornecedor_id: "", ncm: "", ean: "", unidade: "UN",
  imagem_url: "", custo: "", preco_bruto: "", estoque_minimo: "0",
  peso: "", altura: "", largura: "", comprimento: "", ativo: true, observacoes: "",
};

export default function ProdutoProprioForm({
  fornecedores,
  initial,
  produtoId,
}: {
  fornecedores: Opt[];
  initial?: Partial<typeof base>;
  produtoId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ ...base, ...initial });
  const set = (k: keyof typeof base, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  function salvar() {
    if (!f.sku.trim() || f.nome.trim().length < 2) return toast.error("Preencha SKU e nome.");
    start(async () => {
      const res = await salvarProdutoProprio(produtoId ?? null, f);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Produto salvo.");
      router.push("/sistema/estoque");
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader title="Dados do produto" />
        <CardBody className="space-y-4">
          <FormGrid>
            <Field label="SKU" required><Input value={f.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
            <Field label="Fornecedor">
              <Select value={f.fornecedor_id} onChange={(e) => set("fornecedor_id", e.target.value)}>
                <option value="">—</option>
                {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </Select>
            </Field>
          </FormGrid>
          <Field label="Nome" required><Input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
          <Field label="Descrição"><Textarea value={f.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} /></Field>
          <FormGrid>
            <Field label="NCM"><Input value={f.ncm} onChange={(e) => set("ncm", e.target.value)} /></Field>
            <Field label="EAN"><Input value={f.ean} onChange={(e) => set("ean", e.target.value)} /></Field>
            <Field label="Unidade"><Input value={f.unidade} onChange={(e) => set("unidade", e.target.value)} /></Field>
            <Field label="Foto (link)"><Input value={f.imagem_url} onChange={(e) => set("imagem_url", e.target.value)} /></Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Preço e estoque" />
        <CardBody className="space-y-4">
          <FormGrid>
            <Field label="Custo (R$)" hint="Atualizado pelas compras"><Input value={f.custo} onChange={(e) => set("custo", e.target.value)} inputMode="decimal" /></Field>
            <Field label="Preço de venda (R$)"><Input value={f.preco_bruto} onChange={(e) => set("preco_bruto", e.target.value)} inputMode="decimal" /></Field>
            <Field label="Estoque mínimo"><Input value={f.estoque_minimo} onChange={(e) => set("estoque_minimo", e.target.value)} inputMode="numeric" /></Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Logística" />
        <CardBody>
          <FormGrid>
            <Field label="Peso (kg)"><Input value={f.peso} onChange={(e) => set("peso", e.target.value)} inputMode="decimal" /></Field>
            <Field label="Altura (cm)"><Input value={f.altura} onChange={(e) => set("altura", e.target.value)} inputMode="decimal" /></Field>
            <Field label="Largura (cm)"><Input value={f.largura} onChange={(e) => set("largura", e.target.value)} inputMode="decimal" /></Field>
            <Field label="Comprimento (cm)"><Input value={f.comprimento} onChange={(e) => set("comprimento", e.target.value)} inputMode="decimal" /></Field>
          </FormGrid>
        </CardBody>
      </Card>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} className="h-4 w-4 rounded border-neutral-300 text-brand" />
        Ativo
      </label>

      <div className="flex gap-2">
        <Button onClick={salvar} loading={pending}>Salvar</Button>
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </div>
  );
}
