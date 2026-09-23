"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Upload } from "lucide-react";
import { importarProdutosML, type ImportarMlItem } from "@/lib/sistema/actions/linha-propria";
import { formatBRL } from "@/lib/sistema/format";
import { Select, Input } from "@/components/sistema/ui/Field";
import { Button } from "@/components/sistema/ui/Button";
import { Badge } from "@/components/sistema/ui/Badge";

export interface MlAnuncioItem {
  mlItemId: string;
  titulo: string;
  preco: number;
  imagemUrl: string | null;
  categoryId: string;
  categoryNome: string;
  marca: string | null;
  quantidadeDisponivel: number;
  status: string;
  listingTypeId: string;
  logisticType: string | null;
  vendidos: number;
}

const TIPO_ANUNCIO_LABEL: Record<string, string> = {
  gold_pro: "Premium",
  gold_special: "Clássico",
  gold_premium: "Premium",
  gold: "Premium (legado)",
  silver: "Grátis (legado)",
  bronze: "Grátis (legado)",
  free: "Grátis",
};

const ENVIO_LABEL: Record<string, string> = {
  fulfillment: "Full",
  self_service: "Flex",
  cross_docking: "Coleta (agência)",
  drop_off: "Correios",
  xd_drop_off: "Coleta programada",
  not_specified: "A combinar",
};

const ESTOQUE_BAIXO_LIMITE = 5;

type Ordenacao = "" | "preco_asc" | "preco_desc" | "estoque_asc" | "estoque_desc" | "vendidos_desc";

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
  const [categoriaId, setCategoriaId] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [tipoAnuncio, setTipoAnuncio] = useState("");
  const [envio, setEnvio] = useState("");
  const [soEstoqueBaixo, setSoEstoqueBaixo] = useState(false);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [skus, setSkus] = useState<Record<string, string>>(() =>
    Object.fromEntries(itens.map((i) => [i.mlItemId, i.mlItemId]))
  );

  const categorias = useMemo(() => {
    const porId = new Map<string, string>();
    for (const i of itens) porId.set(i.categoryId, i.categoryNome);
    return [...porId.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [itens]);

  const tiposAnuncio = useMemo(
    () => [...new Set(itens.map((i) => i.listingTypeId))].sort(),
    [itens]
  );
  const tiposEnvio = useMemo(
    () => [...new Set(itens.map((i) => i.logisticType).filter((v): v is string => !!v))].sort(),
    [itens]
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = itens.filter((i) => {
      if (categoriaId && i.categoryId !== categoriaId) return false;
      if (statusFiltro && i.status !== statusFiltro) return false;
      if (tipoAnuncio && i.listingTypeId !== tipoAnuncio) return false;
      if (envio && i.logisticType !== envio) return false;
      if (soEstoqueBaixo && i.quantidadeDisponivel > ESTOQUE_BAIXO_LIMITE) return false;
      if (q && !i.titulo.toLowerCase().includes(q)) return false;
      return true;
    });
    if (!ordenacao) return lista;
    const sorted = [...lista];
    switch (ordenacao) {
      case "preco_asc":
        sorted.sort((a, b) => a.preco - b.preco);
        break;
      case "preco_desc":
        sorted.sort((a, b) => b.preco - a.preco);
        break;
      case "estoque_asc":
        sorted.sort((a, b) => a.quantidadeDisponivel - b.quantidadeDisponivel);
        break;
      case "estoque_desc":
        sorted.sort((a, b) => b.quantidadeDisponivel - a.quantidadeDisponivel);
        break;
      case "vendidos_desc":
        sorted.sort((a, b) => b.vendidos - a.vendidos);
        break;
    }
    return sorted;
  }, [itens, busca, categoriaId, statusFiltro, tipoAnuncio, envio, soEstoqueBaixo, ordenacao]);

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
        ml_category_nome: i.categoryNome,
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
    return <p className="text-sm text-neutral-600">Nenhum anúncio encontrado (ou todos já foram importados).</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título…" className="pl-8" />
        </div>
        <div className="min-w-44">
          <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-36">
          <Select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
            <option value="">Ativos e pausados</option>
            <option value="active">Só ativos</option>
            <option value="paused">Só pausados</option>
          </Select>
        </div>
        <div className="min-w-36">
          <Select value={tipoAnuncio} onChange={(e) => setTipoAnuncio(e.target.value)}>
            <option value="">Todos os tipos</option>
            {tiposAnuncio.map((t) => (
              <option key={t} value={t}>
                {TIPO_ANUNCIO_LABEL[t] ?? t}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-36">
          <Select value={envio} onChange={(e) => setEnvio(e.target.value)}>
            <option value="">Todo tipo de envio</option>
            {tiposEnvio.map((t) => (
              <option key={t} value={t}>
                {ENVIO_LABEL[t] ?? t}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-40">
          <Select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}>
            <option value="">Ordenar por…</option>
            <option value="preco_asc">Preço: menor primeiro</option>
            <option value="preco_desc">Preço: maior primeiro</option>
            <option value="estoque_desc">Estoque: maior primeiro</option>
            <option value="estoque_asc">Estoque: menor primeiro</option>
            <option value="vendidos_desc">Mais vendidos</option>
          </Select>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={soEstoqueBaixo}
            onChange={(e) => setSoEstoqueBaixo(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-brand"
          />
          Estoque baixo (≤ {ESTOQUE_BAIXO_LIMITE})
        </label>
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

      <p className="text-xs text-neutral-500">
        {filtrados.length} de {itens.length} anúncio(s) com esse filtro.
      </p>

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
                {formatBRL(i.preco)} · {i.quantidadeDisponivel} disponível(is) · {i.vendidos} vendido(s) · {i.categoryNome}
                {i.marca ? ` · ${i.marca}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <Badge tone={i.status === "active" ? "green" : "yellow"}>{i.status === "active" ? "Ativo" : "Pausado"}</Badge>
              <Badge tone="blue">{TIPO_ANUNCIO_LABEL[i.listingTypeId] ?? i.listingTypeId}</Badge>
              {i.logisticType && <Badge tone="purple">{ENVIO_LABEL[i.logisticType] ?? i.logisticType}</Badge>}
              {i.quantidadeDisponivel <= ESTOQUE_BAIXO_LIMITE && <Badge tone="red">Estoque baixo</Badge>}
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
