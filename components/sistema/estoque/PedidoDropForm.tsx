"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { salvarPedidoDrop } from "@/lib/sistema/actions/pedido-drop";
import { CANAL_VENDA_OPTIONS } from "@/lib/sistema/types";
import { formatBRL, parseNumeroBR } from "@/lib/sistema/format";
import { Card, CardBody, CardHeader } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, Textarea, Select, FormGrid } from "@/components/sistema/ui/Field";

interface ProdOpt { id: string; sku: string; nome: string; preco: number; custo: number; saldo: number }
interface Linha { produto_id: string; quantidade: string; preco_venda: string }

export default function PedidoDropForm({
  sellers,
  produtos,
}: {
  sellers: { id: string; label: string }[];
  produtos: ProdOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cliente, setCliente] = useState(sellers[0]?.id ?? "");
  const [canal, setCanal] = useState("");
  const [pedidoExterno, setPedidoExterno] = useState("");
  const [frete, setFrete] = useState("");
  const [obs, setObs] = useState("");
  const [ent, setEnt] = useState({
    entrega_nome: "", entrega_documento: "", entrega_telefone: "", entrega_cep: "",
    entrega_logradouro: "", entrega_numero: "", entrega_complemento: "", entrega_bairro: "",
    entrega_cidade: "", entrega_uf: "",
  });
  const setE = (k: keyof typeof ent, v: string) => setEnt((s) => ({ ...s, [k]: v }));
  const [linhas, setLinhas] = useState<Linha[]>([{ produto_id: "", quantidade: "1", preco_venda: "" }]);
  const pmap = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  function setLinha(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  let venda = 0, custo = 0;
  for (const l of linhas) {
    const q = parseNumeroBR(l.quantidade) ?? 0;
    venda += q * (parseNumeroBR(l.preco_venda) ?? 0);
    custo += q * (pmap.get(l.produto_id)?.custo ?? 0);
  }
  const freteN = parseNumeroBR(frete) ?? 0;
  const total = venda + freteN;
  const margem = venda - custo;

  function salvar() {
    const itens = linhas
      .filter((l) => l.produto_id && (parseNumeroBR(l.quantidade) ?? 0) > 0)
      .map((l) => ({
        produto_id: l.produto_id,
        quantidade: Math.round(parseNumeroBR(l.quantidade) ?? 0),
        preco_venda: parseNumeroBR(l.preco_venda) ?? 0,
      }));
    if (!cliente) return toast.error("Selecione o seller.");
    if (!itens.length) return toast.error("Adicione ao menos um produto.");
    start(async () => {
      const res = await salvarPedidoDrop(null, {
        cliente_id: cliente, canal, pedido_externo: pedidoExterno, frete,
        observacao_interna: obs, ...ent, itens,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Pedido drop #${res.numero} criado.`);
      router.push(`/sistema/pedidos/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader title="Pedido" />
        <CardBody>
          <FormGrid>
            <Field label="Seller" required>
              <Select value={cliente} onChange={(e) => setCliente(e.target.value)}>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Canal">
              <Select value={canal} onChange={(e) => setCanal(e.target.value)}>
                <option value="">—</option>
                {CANAL_VENDA_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Nº do pedido no canal"><Input value={pedidoExterno} onChange={(e) => setPedidoExterno(e.target.value)} /></Field>
            <Field label="Frete (R$)"><Input value={frete} onChange={(e) => setFrete(e.target.value)} inputMode="decimal" /></Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Itens"
          action={
            <button onClick={() => setLinhas((l) => [...l, { produto_id: "", quantidade: "1", preco_venda: "" }])} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              <Plus size={14} /> Item
            </button>
          }
        />
        <CardBody className="space-y-2">
          {linhas.map((l, i) => {
            const p = pmap.get(l.produto_id);
            return (
              <div key={i} className="grid grid-cols-[1fr_64px_100px_28px] items-end gap-2">
                <Field label={i === 0 ? "Produto" : undefined}>
                  <Select
                    value={l.produto_id}
                    onChange={(e) => {
                      const np = pmap.get(e.target.value);
                      setLinha(i, { produto_id: e.target.value, preco_venda: l.preco_venda || (np ? String(np.preco || "") : "") });
                    }}
                  >
                    <option value="">Selecione…</option>
                    {produtos.map((x) => <option key={x.id} value={x.id}>{x.sku} — {x.nome} (est. {x.saldo})</option>)}
                  </Select>
                </Field>
                <Field label={i === 0 ? "Qtd" : undefined}>
                  <Input value={l.quantidade} onChange={(e) => setLinha(i, { quantidade: e.target.value })} inputMode="numeric" />
                </Field>
                <Field label={i === 0 ? "Preço venda" : undefined}>
                  <Input value={l.preco_venda} onChange={(e) => setLinha(i, { preco_venda: e.target.value })} inputMode="decimal" />
                </Field>
                <button onClick={() => setLinhas((ls) => ls.filter((_, idx) => idx !== i))} disabled={linhas.length === 1} className="mb-2 rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
                {p && (parseNumeroBR(l.quantidade) ?? 0) > (p.saldo ?? 0) && (
                  <div className="col-span-4 text-xs font-medium text-red-600">Estoque insuficiente ({p.saldo} disp.)</div>
                )}
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Entrega (consumidor final)" />
        <CardBody>
          <FormGrid>
            <Field label="Nome"><Input value={ent.entrega_nome} onChange={(e) => setE("entrega_nome", e.target.value)} /></Field>
            <Field label="CPF/CNPJ"><Input value={ent.entrega_documento} onChange={(e) => setE("entrega_documento", e.target.value)} /></Field>
            <Field label="Telefone"><Input value={ent.entrega_telefone} onChange={(e) => setE("entrega_telefone", e.target.value)} inputMode="tel" /></Field>
            <Field label="CEP"><Input value={ent.entrega_cep} onChange={(e) => setE("entrega_cep", e.target.value)} inputMode="numeric" /></Field>
            <Field label="Logradouro"><Input value={ent.entrega_logradouro} onChange={(e) => setE("entrega_logradouro", e.target.value)} /></Field>
            <Field label="Número"><Input value={ent.entrega_numero} onChange={(e) => setE("entrega_numero", e.target.value)} /></Field>
            <Field label="Complemento"><Input value={ent.entrega_complemento} onChange={(e) => setE("entrega_complemento", e.target.value)} /></Field>
            <Field label="Bairro"><Input value={ent.entrega_bairro} onChange={(e) => setE("entrega_bairro", e.target.value)} /></Field>
            <Field label="Cidade"><Input value={ent.entrega_cidade} onChange={(e) => setE("entrega_cidade", e.target.value)} /></Field>
            <Field label="UF"><Input value={ent.entrega_uf} onChange={(e) => setE("entrega_uf", e.target.value)} maxLength={2} /></Field>
          </FormGrid>
        </CardBody>
      </Card>

      <Field label="Observação interna"><Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} /></Field>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <div className="flex justify-between"><span className="text-neutral-500">Venda</span><span>{formatBRL(venda)}</span></div>
        <div className="flex justify-between"><span className="text-neutral-500">Frete</span><span>{formatBRL(freteN)}</span></div>
        <div className="flex justify-between"><span className="text-neutral-500">Custo</span><span>-{formatBRL(custo)}</span></div>
        <div className="mt-1 flex justify-between border-t border-neutral-100 pt-1 font-semibold">
          <span>Total do pedido</span><span>{formatBRL(total)}</span>
        </div>
        <div className="flex justify-between font-semibold text-green-700">
          <span>Margem (venda − custo)</span><span>{formatBRL(margem)}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={salvar} loading={pending}>Criar pedido</Button>
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </div>
  );
}
