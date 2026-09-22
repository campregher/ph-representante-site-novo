"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Upload } from "lucide-react";
import { importarProdutosML, type ImportarMlItem } from "@/lib/sistema/actions/linha-propria";
import { formatBRL } from "@/lib/sistema/format";
import { Select, Input } from "@/components/sistema/ui/Field";
import { Button } from "@/components/sistema/ui/Button";

export interface MlAnuncioItem {
  mlItemId: string;
  titulo: string;
  preco: number;
  imagemUrl: string | null;
  categoryId: string;
  marca: string | null;
  quantidadeDisponivel: number;
}

export default function ImportarProdutosMlForm({
  itens,
  fornecedores,
}: {
  itens: MlAnuncioItem[];
  fornecedores: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busca, setBusca] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [skus, setSkus] = useState<Record<string, string>>(() =>
    Object.fromEntries(itens.map((i) => [i.mlItemId, i.mlItemId]))
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((i) => i.titulo.toLowerCase().includes(q));
  }, [itens, busca]);

  function toggle(id: string) {
    setSelecionados((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (selecionados.size === filtrados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(filtrados.map((i) => i.mlItemId)));
    }
  }

  function importar() {
    if (selecionados.size === 0) return;
    for (const id of selecionados) {
      if (!skus[id]?.trim()) {
        toast.error("Todo item selecionado precisa de um SKU.");
        return;
      }
    }
    const payload: ImportarMlItem[] = itens
      .filter((i) => selecionados.has(i.mlItemId))
      .map((i) => ({
        mlItemId: i.mlItemId,
        sku: skus[i.mlItemId].trim(),
        nome: i.titulo,
        imagem_url: i.imagemUrl,
        marca: i.marca,
        preco_bruto: i.preco,
        ml_category_id: i.categoryId,
        ml_category_nome: null,
        quantidadeDisponivel: i.quantidadeDisponivel,
        fornecedor_id: fornecedorId || null,
      }));

    start(async () => {
      const res = await importarProdutosML(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.falhas.length === 0) {
        toast.success(`${res.importados} produto(s) importado(s).`);
      } else {
        toast.error(`${res.importados} importado(s), ${res.falhas.length} falharam (${res.falhas.map((f) => f.error).join("; ")}).`);
      }
      setSelecionados(new Set());
      router.push("/sistema/estoque");
      router.refresh();
    });
  }

  if (itens.length === 0) {
    return <p className="text-sm text-neutral-600">Nenhum anúncio ativo encontrado (ou todos já foram importados).</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título…" className="pl-8" />
        </div>
        <div className="min-w-48">
          <Select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
            <option value="">Fornecedor (opcional, aplica a todos)</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={toggleTodos}>
          {selecionados.size === filtrados.length ? "Desmarcar todos" : "Selecionar todos"}
        </Button>
        <Button size="sm" onClick={importar} loading={pending} disabled={selecionados.size === 0}>
          <Upload size={14} /> Importar selecionados ({selecionados.size})
        </Button>
      </div>

      <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {filtrados.map((i) => (
          <div key={i.mlItemId} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={selecionados.has(i.mlItemId)}
              onChange={() => toggle(i.mlItemId)}
              className="h-4 w-4 rounded border-neutral-300 text-brand"
            />
            {i.imagemUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.imagemUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded bg-neutral-100" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">{i.titulo}</p>
              <p className="text-xs text-neutral-400">
                {formatBRL(i.preco)} · {i.quantidadeDisponivel} disponível(is)
                {i.marca ? ` · ${i.marca}` : ""}
              </p>
            </div>
            <Input
              value={skus[i.mlItemId] ?? ""}
              onChange={(e) => setSkus((s) => ({ ...s, [i.mlItemId]: e.target.value }))}
              placeholder="SKU"
              className="w-32 shrink-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
