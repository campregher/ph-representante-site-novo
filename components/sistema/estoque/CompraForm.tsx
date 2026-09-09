"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { salvarCompra } from "@/lib/sistema/actions/linha-propria";
import { formatBRL, parseNumeroBR } from "@/lib/sistema/format";
import { Card, CardBody, CardHeader } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, Select, FormGrid } from "@/components/sistema/ui/Field";

interface ProdOpt { id: string; sku: string; nome: string; custo: number }
interface Linha { produto_id: string; quantidade: string; custo_unitario: string }

export default function CompraForm({
  fornecedores,
  produtos,
}: {
  fornecedores: { id: string; label: string }[];
  produtos: ProdOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fornecedor, setFornecedor] = useState("");
  const [nota, setNota] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [frete, setFrete] = useState("");
  const [outras, setOutras] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([{ produto_id: "", quantidade: "1", custo_unitario: "" }]);

  const pmap = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  function setLinha(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLinha() {
    setLinhas((ls) => [...ls, { produto_id: "", quantidade: "1", custo_unitario: "" }]);
  }
  function delLinha(i: number) {
    setLinhas((ls) => ls.filter((_, idx) => idx !== i));
  }

  const subtotal = linhas.reduce(
    (s, l) => s + (parseNumeroBR(l.quantidade) ?? 0) * (parseNumeroBR(l.custo_unitario) ?? 0),
    0
  );
  const total = subtotal + (parseNumeroBR(frete) ?? 0) + (parseNumeroBR(outras) ?? 0);

  function salvar() {
    const itens = linhas
      .filter((l) => l.produto_id && (parseNumeroBR(l.quantidade) ?? 0) > 0)
      .map((l) => ({
        produto_id: l.produto_id,
        quantidade: Math.round(parseNumeroBR(l.quantidade) ?? 0),
        custo_unitario: parseNumeroBR(l.custo_unitario) ?? 0,
      }));
    if (!itens.length) return toast.error("Adicione ao menos um item.");
    start(async () => {
      const res = await salvarCompra({
        fornecedor_id: fornecedor,
        numero_nota: nota,
        data_compra: data,
        frete,
        outras_despesas: outras,
        itens,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Compra registrada — estoque atualizado.");
      router.push("/sistema/estoque/compras");
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader title="Compra" />
        <CardBody>
          <FormGrid>
            <Field label="Fornecedor">
              <Select value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}>
                <option value="">—</option>
                {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </Select>
            </Field>
            <Field label="Nº da nota"><Input value={nota} onChange={(e) => setNota(e.target.value)} /></Field>
            <Field label="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
            <Field label="Frete (R$)"><Input value={frete} onChange={(e) => setFrete(e.target.value)} inputMode="decimal" /></Field>
            <Field label="Outras despesas (R$)"><Input value={outras} onChange={(e) => setOutras(e.target.value)} inputMode="decimal" /></Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Itens" action={<button onClick={addLinha} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"><Plus size={14} /> Item</button>} />
        <CardBody className="space-y-2">
          {linhas.map((l, i) => {
            const p = pmap.get(l.produto_id);
            const sub = (parseNumeroBR(l.quantidade) ?? 0) * (parseNumeroBR(l.custo_unitario) ?? 0);
            return (
              <div key={i} className="grid grid-cols-[1fr_70px_100px_90px_28px] items-end gap-2">
                <Field label={i === 0 ? "Produto" : undefined}>
                  <Select
                    value={l.produto_id}
                    onChange={(e) => {
                      const np = pmap.get(e.target.value);
                      setLinha(i, { produto_id: e.target.value, custo_unitario: l.custo_unitario || (np ? String(np.custo || "") : "") });
                    }}
                  >
                    <option value="">Selecione…</option>
                    {produtos.map((x) => <option key={x.id} value={x.id}>{x.sku} — {x.nome}</option>)}
                  </Select>
                </Field>
                <Field label={i === 0 ? "Qtd" : undefined}>
                  <Input value={l.quantidade} onChange={(e) => setLinha(i, { quantidade: e.target.value })} inputMode="numeric" />
                </Field>
                <Field label={i === 0 ? "Custo un." : undefined}>
                  <Input value={l.custo_unitario} onChange={(e) => setLinha(i, { custo_unitario: e.target.value })} inputMode="decimal" />
                </Field>
                <div className="pb-2 text-right text-sm text-neutral-600">{formatBRL(sub)}</div>
                <button onClick={() => delLinha(i)} className="mb-2 rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600" disabled={linhas.length === 1}>
                  <Trash2 size={14} />
                </button>
                <div className="col-span-5 text-xs text-neutral-400">{p ? `Custo médio atual: ${formatBRL(p.custo)}` : ""}</div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
        <span className="text-sm text-neutral-500">Subtotal {formatBRL(subtotal)} + despesas</span>
        <span className="text-lg font-bold text-neutral-900">Total {formatBRL(total)}</span>
      </div>

      <div className="flex gap-2">
        <Button onClick={salvar} loading={pending}>Registrar compra</Button>
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </div>
  );
}
