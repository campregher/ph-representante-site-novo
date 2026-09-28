"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw, ExternalLink } from "lucide-react";
import { ressincronizarProdutosML } from "@/lib/sistema/actions/linha-propria";
import { formatBRL } from "@/lib/sistema/format";
import { Button } from "@/components/sistema/ui/Button";
import { Badge } from "@/components/sistema/ui/Badge";

export interface ProdutoImportadoItem {
  produtoId: string;
  sku: string;
  nome: string;
  imagemUrl: string | null;
  precoBruto: number | null;
  estoqueAtual: number;
  ativo: boolean;
  mlItemId: string;
  anuncio: { titulo: string; preco: number; status: string; permalink: string } | null;
}

export default function AnunciosImportadosList({ itens }: { itens: ProdutoImportadoItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelecionados((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    setSelecionados((s) => (s.size === itens.length ? new Set() : new Set(itens.map((i) => i.produtoId))));
  }

  function ressincronizar() {
    if (selecionados.size === 0) return;
    start(async () => {
      const res = await ressincronizarProdutosML([...selecionados]);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.falhas.length === 0) {
        toast.success(`${res.atualizados} produto(s) ressincronizado(s).`);
      } else {
        toast.error(
          `${res.atualizados} ressincronizado(s), ${res.falhas.length} falharam: ${res.falhas
            .map((f) => f.error)
            .join("; ")}`
        );
      }
      setSelecionados(new Set());
      router.refresh();
    });
  }

  if (itens.length === 0) {
    return <p className="text-sm text-neutral-600">Nenhum produto importado do Mercado Livre ainda.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={toggleTodos} className="text-sm font-medium text-brand hover:underline">
          {selecionados.size === itens.length ? "Desmarcar todos" : "Selecionar todos"}
        </button>
        <Button size="sm" variant="outline" onClick={ressincronizar} loading={pending} disabled={selecionados.size === 0}>
          <RefreshCw size={14} /> Ressincronizar selecionados ({selecionados.size})
        </Button>
      </div>

      <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {itens.map((i) => {
          const precoDivergente = i.anuncio && i.precoBruto != null && Math.abs(i.anuncio.preco - i.precoBruto) > 0.01;
          return (
            <div key={i.produtoId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={selecionados.has(i.produtoId)}
                onChange={() => toggle(i.produtoId)}
                className="h-4 w-4 rounded border-neutral-300 text-brand"
              />
              {i.imagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.imagemUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded bg-neutral-100" />
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/sistema/estoque/produtos/${i.produtoId}/editar`} className="truncate text-sm font-medium text-neutral-900 hover:text-brand">
                  {i.nome}
                </Link>
                <p className="text-xs text-neutral-400">
                  SKU {i.sku} · {i.estoqueAtual} em estoque
                  {i.precoBruto != null ? ` · ${formatBRL(i.precoBruto)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <Badge tone={i.ativo ? "green" : "neutral"}>{i.ativo ? "Ativo no sistema" : "Inativo no sistema"}</Badge>
                {!i.anuncio ? (
                  <Badge tone="red">Não encontrado no ML</Badge>
                ) : (
                  <>
                    <Badge tone={i.anuncio.status === "active" ? "green" : "yellow"}>
                      {i.anuncio.status === "active" ? "Ativo no ML" : "Pausado no ML"}
                    </Badge>
                    {precoDivergente && <Badge tone="red">Preço diferente no ML</Badge>}
                  </>
                )}
              </div>
              {i.anuncio && (
                <a
                  href={i.anuncio.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 text-xs text-neutral-500 hover:text-brand"
                >
                  Ver no ML <ExternalLink size={12} />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
