"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Pause, Play, Upload } from "lucide-react";
import {
  publicarProdutoML,
  publicarEmMassaML,
  pausarAnuncioML,
  reativarAnuncioML,
  atualizarPrecoAnuncioML,
} from "@/lib/sistema/actions/seller-ml-catalogo";
import { formatBRL } from "@/lib/sistema/format";
import { Button } from "@/components/sistema/ui/Button";

export interface AnuncioView {
  mlContaId: string;
  contaNickname: string | null;
  mlItemId: string;
  status: string;
  precoRevenda: number;
  permalink: string | null;
}

export interface CatalogoDropItemView {
  id: string;
  sku: string;
  nome: string;
  categoria: string | null;
  estoque_atual: number;
  precoMinimo: number;
  mlCategoriaDefinida: boolean;
  anuncios: AnuncioView[];
}

export interface MlContaView {
  id: string;
  nickname: string | null;
}

export default function SellerCatalogoDrop({
  token,
  itens,
  mlContas,
}: {
  token: string;
  itens: CatalogoDropItemView[];
  mlContas: MlContaView[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [precos, setPrecos] = useState<Record<string, string>>(() =>
    Object.fromEntries(itens.map((p) => [p.id, String(p.anuncios[0]?.precoRevenda ?? p.precoMinimo)]))
  );
  const [contaAlvo, setContaAlvo] = useState<Record<string, string>>(() =>
    Object.fromEntries(itens.map((p) => [p.id, mlContas[0]?.id ?? ""]))
  );
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [contaLote, setContaLote] = useState(mlContas[0]?.id ?? "");

  const mlConectado = mlContas.length > 0;

  const contasDisponiveis = (item: CatalogoDropItemView) => {
    const usadas = new Set(item.anuncios.map((a) => a.mlContaId));
    return mlContas.filter((c) => !usadas.has(c.id));
  };

  const publicaveis = useMemo(
    () => itens.filter((p) => p.mlCategoriaDefinida && contasDisponiveis(p).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itens, mlContas]
  );

  function toggleSelecionado(id: string) {
    setSelecionados((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function precoValido(item: CatalogoDropItemView): number | null {
    const v = Number((precos[item.id] ?? "").replace(",", "."));
    if (!Number.isFinite(v) || v < item.precoMinimo) return null;
    return v;
  }

  function publicar(item: CatalogoDropItemView) {
    const preco = precoValido(item);
    if (preco == null) {
      toast.error(`Preço mínimo pra esse produto é ${formatBRL(item.precoMinimo)}.`);
      return;
    }
    const conta = contaAlvo[item.id];
    if (!conta) {
      toast.error("Escolha em qual conta publicar.");
      return;
    }
    start(async () => {
      const res = await publicarProdutoML(token, conta, item.id, preco);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Anúncio publicado no Mercado Livre.");
      router.refresh();
    });
  }

  function publicarSelecionados() {
    if (!contaLote) {
      toast.error("Escolha em qual conta publicar.");
      return;
    }
    const itensSelecionados = publicaveis.filter((p) => selecionados.has(p.id));
    if (itensSelecionados.length === 0) return;
    const payload: { produtoId: string; precoRevenda: number }[] = [];
    for (const item of itensSelecionados) {
      const preco = precoValido(item);
      if (preco == null) {
        toast.error(`${item.nome}: preço mínimo é ${formatBRL(item.precoMinimo)}.`);
        return;
      }
      payload.push({ produtoId: item.id, precoRevenda: preco });
    }
    start(async () => {
      const res = await publicarEmMassaML(token, contaLote, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const falhas = res.resultados.filter((r) => !r.ok);
      if (falhas.length === 0) toast.success(`${res.resultados.length} anúncios publicados.`);
      else toast.error(`${res.resultados.length - falhas.length} publicados, ${falhas.length} falharam.`);
      setSelecionados(new Set());
      router.refresh();
    });
  }

  function pausar(item: CatalogoDropItemView, mlContaId: string) {
    start(async () => {
      const res = await pausarAnuncioML(token, mlContaId, item.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Anúncio pausado.");
      router.refresh();
    });
  }

  function reativar(item: CatalogoDropItemView, mlContaId: string) {
    start(async () => {
      const res = await reativarAnuncioML(token, mlContaId, item.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Anúncio reativado.");
      router.refresh();
    });
  }

  function atualizarPreco(item: CatalogoDropItemView, mlContaId: string) {
    const preco = precoValido(item);
    if (preco == null) {
      toast.error(`Preço mínimo pra esse produto é ${formatBRL(item.precoMinimo)}.`);
      return;
    }
    start(async () => {
      const res = await atualizarPrecoAnuncioML(token, mlContaId, item.id, preco);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Preço atualizado.");
      router.refresh();
    });
  }

  if (itens.length === 0) {
    return <p className="text-sm text-neutral-600">Nenhum produto disponível pra venda no momento.</p>;
  }

  return (
    <div className="space-y-3">
      {!mlConectado && (
        <p className="rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
          Conecte uma conta do Mercado Livre em Integração pra poder publicar anúncios.
        </p>
      )}
      {selecionados.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2">
          <span className="text-xs text-neutral-600">{selecionados.size} selecionado(s)</span>
          <div className="flex items-center gap-2">
            <select
              value={contaLote}
              onChange={(e) => setContaLote(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
            >
              {mlContas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname ?? "Conta ML"}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={publicarSelecionados} loading={pending} disabled={!mlConectado}>
              <Upload size={14} /> Publicar selecionados
            </Button>
          </div>
        </div>
      )}
      <div className="divide-y divide-neutral-100">
        {itens.map((p) => {
          const disponiveis = contasDisponiveis(p);
          const podeSelecionar = p.mlCategoriaDefinida && disponiveis.length > 0;
          return (
            <div key={p.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  {podeSelecionar && (
                    <input
                      type="checkbox"
                      checked={selecionados.has(p.id)}
                      onChange={() => toggleSelecionado(p.id)}
                      disabled={!mlConectado}
                      className="mt-1 h-4 w-4 rounded border-neutral-300 text-brand"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900">{p.nome}</p>
                    <p className="text-xs text-neutral-400">
                      SKU {p.sku}
                      {p.categoria ? ` · ${p.categoria}` : ""} · {p.estoque_atual} em estoque · mín.{" "}
                      {formatBRL(p.precoMinimo)}
                    </p>
                    {!p.mlCategoriaDefinida && (
                      <p className="text-xs text-yellow-600">Categoria do ML ainda não configurada — fale com a PH.</p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <input
                    value={precos[p.id] ?? ""}
                    onChange={(e) => setPrecos((s) => ({ ...s, [p.id]: e.target.value }))}
                    inputMode="decimal"
                    className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  {disponiveis.length > 0 && p.mlCategoriaDefinida && (
                    <>
                      {disponiveis.length > 1 && (
                        <select
                          value={contaAlvo[p.id] ?? ""}
                          onChange={(e) => setContaAlvo((s) => ({ ...s, [p.id]: e.target.value }))}
                          className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
                        >
                          {disponiveis.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nickname ?? "Conta ML"}
                            </option>
                          ))}
                        </select>
                      )}
                      <Button size="sm" onClick={() => publicar(p)} loading={pending} disabled={!mlConectado}>
                        <Upload size={13} /> Publicar
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {p.anuncios.length > 0 && (
                <div className="ml-6 space-y-1.5">
                  {p.anuncios.map((a) => (
                    <div
                      key={a.mlContaId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-1.5"
                    >
                      <span className="text-xs font-medium text-neutral-600">{a.contaNickname ?? "Conta ML"}</span>
                      <div className="flex items-center gap-2">
                        {a.status === "paused" ? (
                          <>
                            <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-500">
                              Pausado
                            </span>
                            <Button size="sm" variant="outline" onClick={() => reativar(p, a.mlContaId)} loading={pending}>
                              <Play size={13} /> Reativar
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                              Anunciado
                            </span>
                            {a.permalink && (
                              <a
                                href={a.permalink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-neutral-400 hover:text-brand"
                                title="Ver no Mercado Livre"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                            <Button size="sm" variant="outline" onClick={() => atualizarPreco(p, a.mlContaId)} loading={pending}>
                              Atualizar preço
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => pausar(p, a.mlContaId)} loading={pending}>
                              <Pause size={13} /> Pausar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
