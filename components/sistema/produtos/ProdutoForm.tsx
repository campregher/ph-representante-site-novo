"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { produtoSchema, type ProdutoInput } from "@/lib/sistema/schemas";
import { saveProduto, createCategoria, salvarVariacoes } from "@/lib/sistema/actions/produtos";
import { UNIDADE_OPTIONS, type Produto } from "@/lib/sistema/types";
import { parseNumeroBR } from "@/lib/sistema/format";
import { Field, Input, Textarea, Select, Checkbox, FormGrid } from "@/components/sistema/ui/Field";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import { Modal } from "@/components/sistema/ui/Modal";
import FormActions from "@/components/sistema/FormActions";
import VariacoesEditor, {
  emptyVariacoesState,
  type VariacoesState,
} from "@/components/sistema/produtos/VariacoesEditor";

interface Categoria {
  id: string;
  nome: string;
  representada_id: string;
}

export default function ProdutoForm({
  initial,
  representadaOptions,
  categorias: categoriasProp,
  lockRepresentada,
  initialVariacoes,
}: {
  initial?: Produto;
  representadaOptions: { id: string; label: string }[];
  categorias: Categoria[];
  lockRepresentada?: string;
  initialVariacoes?: VariacoesState;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [categorias, setCategorias] = useState<Categoria[]>(categoriasProp);
  const [catModal, setCatModal] = useState(false);
  const [catNome, setCatNome] = useState("");
  const [catSaving, startCat] = useTransition();
  const [variacoes, setVariacoes] = useState<VariacoesState>(
    initialVariacoes ?? emptyVariacoesState()
  );

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ProdutoInput>({
    resolver: zodResolver(produtoSchema),
    defaultValues: initial
      ? {
          representada_id: initial.representada_id,
          categoria_id: initial.categoria_id ?? "",
          sku: initial.sku,
          codigo_fabrica: initial.codigo_fabrica ?? "",
          ean: initial.ean ?? "",
          ncm: initial.ncm ?? "",
          nome: initial.nome,
          descricao: initial.descricao ?? "",
          marca: initial.marca ?? "",
          aplicacao: initial.aplicacao ?? "",
          montadora: initial.montadora ?? "",
          modelo: initial.modelo ?? "",
          ano_inicio: initial.ano_inicio ?? "",
          ano_fim: initial.ano_fim ?? "",
          unidade: initial.unidade ?? "UN",
          peso: initial.peso ?? "",
          preco_bruto: initial.preco_bruto ?? "",
          altura: initial.altura ?? "",
          largura: initial.largura ?? "",
          comprimento: initial.comprimento ?? "",
          imagem_url: initial.imagem_url ?? "",
          observacoes: initial.observacoes ?? "",
          ativo: initial.ativo,
        }
      : { representada_id: lockRepresentada ?? "", unidade: "UN", ativo: true, categoria_id: "" },
  });

  const repId = useWatch({ control, name: "representada_id" });
  const skuAtual = (useWatch({ control, name: "sku" }) as string) ?? "";
  const precoBrutoAtual = useWatch({ control, name: "preco_bruto" }) as string | number | undefined;
  const catsDaRep = useMemo(
    () => categorias.filter((c) => c.representada_id === repId),
    [categorias, repId]
  );

  function onSubmit(values: ProdutoInput) {
    if (variacoes.temVariacoes && variacoes.variacoes.some((r) => !r.sku.trim())) {
      toast.error("Toda variação precisa de um SKU.");
      return;
    }
    startTransition(async () => {
      const res = await saveProduto(initial?.id ?? null, values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const produtoId = res.id!;

      const vres = await salvarVariacoes({
        produto_id: produtoId,
        eixos: variacoes.temVariacoes ? variacoes.eixos : [],
        variacoes: variacoes.temVariacoes
          ? variacoes.variacoes.map((r, i) => ({
              sku: r.sku.trim(),
              atributos: Object.fromEntries(
                Object.entries(r.atributos).filter(([, v]) => v)
              ),
              preco_bruto: parseNumeroBR(r.preco_bruto),
              codigo_fabrica: r.codigo_fabrica || null,
              ean: r.ean || null,
              imagem_url: r.imagem_url || null,
              ativo: r.ativo,
              ordem: i,
            }))
          : [],
      });
      if (!vres.ok) {
        toast.error(`Produto salvo, mas as variações falharam: ${vres.error}`);
        router.push(`/sistema/produtos/${produtoId}`);
        router.refresh();
        return;
      }

      toast.success(initial ? "Produto atualizado." : "Produto criado.");
      router.push(`/sistema/produtos/${produtoId}`);
      router.refresh();
    });
  }

  function salvarCategoria() {
    if (!repId) {
      toast.error("Selecione a representada primeiro.");
      return;
    }
    startCat(async () => {
      const res = await createCategoria({ representada_id: repId, nome: catNome });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const nova = { id: res.id!, nome: res.nome!, representada_id: repId };
      setCategorias((c) => [...c, nova]);
      setValue("categoria_id", nova.id);
      setCatNome("");
      setCatModal(false);
      toast.success("Categoria criada.");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader title="Identificação" />
        <CardBody>
          <FormGrid>
            <Field label="Representada" required error={errors.representada_id?.message}>
              <Select {...register("representada_id")} disabled={!!lockRepresentada || !!initial}>
                <option value="">Selecione…</option>
                {representadaOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Categoria" error={errors.categoria_id?.message}>
              <div className="flex gap-2">
                <Select {...register("categoria_id")} disabled={!repId}>
                  <option value="">— sem categoria —</option>
                  {catsDaRep.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setCatModal(true)}
                  disabled={!repId}
                  title="Nova categoria"
                >
                  <Plus size={15} />
                </Button>
              </div>
            </Field>
            <Field label="SKU" required error={errors.sku?.message}>
              <Input {...register("sku")} className="font-mono" />
            </Field>
            <Field label="Código de fábrica" error={errors.codigo_fabrica?.message}>
              <Input {...register("codigo_fabrica")} />
            </Field>
            <Field label="EAN" error={errors.ean?.message}>
              <Input {...register("ean")} inputMode="numeric" />
            </Field>
            <Field label="NCM" error={errors.ncm?.message}>
              <Input {...register("ncm")} inputMode="numeric" />
            </Field>
            <Field label="Nome" required error={errors.nome?.message} className="sm:col-span-2">
              <Input {...register("nome")} />
            </Field>
            <Field
              label="Preço bruto (R$)"
              error={errors.preco_bruto?.message}
              hint="Preço de lista. As tabelas aplicam desconto sobre ele."
            >
              <Input {...register("preco_bruto")} type="number" step="0.01" min="0" />
            </Field>
            <Field label="Descrição" error={errors.descricao?.message} className="sm:col-span-2">
              <Textarea {...register("descricao")} />
            </Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Aplicação" />
        <CardBody>
          <FormGrid>
            <Field label="Marca" error={errors.marca?.message}>
              <Input {...register("marca")} />
            </Field>
            <Field label="Aplicação" error={errors.aplicacao?.message}>
              <Input {...register("aplicacao")} placeholder="ex.: Tapete dianteiro" />
            </Field>
            <Field label="Montadora" error={errors.montadora?.message}>
              <Input {...register("montadora")} />
            </Field>
            <Field label="Modelo" error={errors.modelo?.message}>
              <Input {...register("modelo")} />
            </Field>
            <Field label="Ano início" error={errors.ano_inicio?.message}>
              <Input {...register("ano_inicio")} type="number" min="1950" max="2100" />
            </Field>
            <Field label="Ano fim" error={errors.ano_fim?.message}>
              <Input {...register("ano_fim")} type="number" min="1950" max="2100" />
            </Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Embalagem e logística" />
        <CardBody>
          <FormGrid>
            <Field label="Unidade" error={errors.unidade?.message}>
              <Select {...register("unidade")}>
                {UNIDADE_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Peso da embalagem (kg)" error={errors.peso?.message}>
              <Input {...register("peso")} type="number" step="0.001" min="0" />
            </Field>
            <Field label="Altura (cm)" error={errors.altura?.message}>
              <Input {...register("altura")} type="number" step="0.01" min="0" />
            </Field>
            <Field label="Largura (cm)" error={errors.largura?.message}>
              <Input {...register("largura")} type="number" step="0.01" min="0" />
            </Field>
            <Field label="Comprimento (cm)" error={errors.comprimento?.message}>
              <Input {...register("comprimento")} type="number" step="0.01" min="0" />
            </Field>
            <Field label="Foto (link)" error={errors.imagem_url?.message}>
              <Input {...register("imagem_url")} placeholder="https://…/foto.jpg" />
            </Field>
          </FormGrid>
          <Field label="Observações" error={errors.observacoes?.message} className="mt-4">
            <Textarea {...register("observacoes")} />
          </Field>
          <div className="mt-4">
            <Checkbox {...register("ativo")} label="Produto ativo" />
          </div>
        </CardBody>
      </Card>

      <VariacoesEditor
        skuPai={skuAtual}
        precoBrutoPai={parseNumeroBR(precoBrutoAtual ?? null)}
        value={variacoes}
        onChange={setVariacoes}
      />

      <FormActions submitLabel={initial ? "Salvar alterações" : "Criar produto"} loading={pending} />

      <Modal
        open={catModal}
        onClose={() => setCatModal(false)}
        title="Nova categoria"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCatModal(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={salvarCategoria} loading={catSaving}>
              Criar
            </Button>
          </>
        }
      >
        <Field label="Nome da categoria">
          <Input
            value={catNome}
            onChange={(e) => setCatNome(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), salvarCategoria())}
          />
        </Field>
      </Modal>
    </form>
  );
}
