"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { ChevronRight, ExternalLink, Pause, Play, Trash2, Upload } from "lucide-react";
import {
  publicarProdutoMLVariasContas,
  publicarGrupoMLVariasContas,
  publicarEmMassaML,
  pausarAnuncioML,
  reativarAnuncioML,
  atualizarPrecoAnuncioML,
  excluirAnuncioML,
  pausarGrupoML,
  reativarGrupoML,
  atualizarPrecoGrupoML,
  excluirGrupoAnuncioML,
} from "@/lib/sistema/actions/seller-ml-catalogo";
import {
  salvarCustomizacaoProdutoSeller,
  restaurarProdutoPadraoSeller,
} from "@/lib/sistema/actions/seller-produto-customizacao";
import { formatBRL } from "@/lib/sistema/format";
import { Button } from "@/components/sistema/ui/Button";
import { Modal, ConfirmDialog } from "@/components/sistema/ui/Modal";
import { Field, Input, Textarea } from "@/components/sistema/ui/Field";
import { Badge } from "@/components/sistema/ui/Badge";

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
  descricao: string | null;
  imagem_url: string | null;
  imagens: string[];
  variacao: string | null;
  categoria: string | null;
  estoque_atual: number;
  precoMinimo: number;
  custoReferencia: number | null;
  personalizado: boolean;
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
  const [contasEscolhidas, setContasEscolhidas] = useState<Record<string, Set<string>>>({});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [contaLote, setContaLote] = useState(mlContas[0]?.id ?? "");
  const [produtosAbertos, setProdutosAbertos] = useState<Set<string>>(new Set());
  const [detalhe, setDetalhe] = useState<CatalogoDropItemView | null>(null);
  const [formDetalhe, setFormDetalhe] = useState({ nome: "", descricao: "", imagens: "" });
  const [confirmExcluir, setConfirmExcluir] = useState<{ mlContaId: string; produtoIds: string[] } | null>(null);

  function toggleConta(itemId: string, contaId: string) {
    setContasEscolhidas((s) => {
      const atual = new Set(s[itemId] ?? []);
      if (atual.has(contaId)) atual.delete(contaId);
      else atual.add(contaId);
      return { ...s, [itemId]: atual };
    });
  }

  function toggleProdutoAberto(chave: string) {
    setProdutosAbertos((s) => {
      const next = new Set(s);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  }

  const mlConectado = mlContas.length > 0;

  const contasDisponiveis = (item: CatalogoDropItemView) => {
    const usadas = new Set(item.anuncios.map((a) => a.mlContaId));
    return mlContas.filter((c) => !usadas.has(c.id));
  };

  // Produtos com o mesmo título são variações (cor/acabamento) do mesmo
  // produto — agrupa pra publicar todas de uma vez (cada uma ainda vira um
  // item próprio no ML, mas com BRAND+PART_NUMBER iguais, que é o que faz
  // o próprio Mercado Livre juntar elas visualmente — ver
  // lib/sistema/dropshipping-ml-catalogo.ts) e pra não listar várias linhas
  // repetidas por produto.
  const grupos = useMemo(() => {
    const porNome = new Map<string, CatalogoDropItemView[]>();
    for (const p of itens) {
      if (!porNome.has(p.nome)) porNome.set(p.nome, []);
      porNome.get(p.nome)!.push(p);
    }
    return [...porNome.values()];
  }, [itens]);

  // Produtos agrupados (variações) só publicam pelo controle do grupo —
  // não entram na seleção avulsa "publicar vários produtos numa conta".
  const idsEmGrupo = useMemo(() => {
    const ids = new Set<string>();
    for (const variantes of grupos) {
      if (variantes.length > 1) for (const p of variantes) ids.add(p.id);
    }
    return ids;
  }, [grupos]);

  const publicaveis = useMemo(
    () => itens.filter((p) => p.mlCategoriaDefinida && contasDisponiveis(p).length > 0 && !idsEmGrupo.has(p.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itens, mlContas, idsEmGrupo]
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

  /** Quando só existe 1 conta disponível pra esse produto, publica nela direto
   *  sem exigir que o seller marque checkbox nenhum — só pede escolha quando
   *  há de fato mais de uma conta pra decidir entre. */
  function contasParaPublicar(item: CatalogoDropItemView): string[] {
    const disponiveis = contasDisponiveis(item);
    if (disponiveis.length <= 1) return disponiveis.map((c) => c.id);
    return [...(contasEscolhidas[item.id] ?? [])];
  }

  function publicar(item: CatalogoDropItemView) {
    const preco = precoValido(item);
    if (preco == null) {
      toast.error(`Preço mínimo pra esse produto é ${formatBRL(item.precoMinimo)}.`);
      return;
    }
    const contas = contasParaPublicar(item);
    if (contas.length === 0) {
      toast.error("Marque em quais contas do Mercado Livre publicar.");
      return;
    }
    start(async () => {
      const res = await publicarProdutoMLVariasContas(token, contas, item.id, preco);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const falhas = res.resultados.filter((r) => !r.ok);
      if (falhas.length === 0) toast.success(`Publicado em ${res.resultados.length} conta(s).`);
      else toast.error(`${res.resultados.length - falhas.length} publicado(s), ${falhas.length} falhou(aram): ${falhas[0].error}`);
      router.refresh();
    });
  }

  function contasDisponiveisGrupo(variantes: CatalogoDropItemView[]) {
    const usadas = new Set(variantes.flatMap((p) => p.anuncios.map((a) => a.mlContaId)));
    return mlContas.filter((c) => !usadas.has(c.id));
  }

  function contasParaPublicarGrupo(variantes: CatalogoDropItemView[]): string[] {
    const disponiveis = contasDisponiveisGrupo(variantes);
    if (disponiveis.length <= 1) return disponiveis.map((c) => c.id);
    return [...(contasEscolhidas[variantes[0].id] ?? [])];
  }

  function publicarGrupo(variantes: CatalogoDropItemView[]) {
    const chave = variantes[0].id;
    const precoMinimoGrupo = Math.max(...variantes.map((v) => v.precoMinimo));
    const v = Number((precos[chave] ?? "").replace(",", "."));
    if (!Number.isFinite(v) || v < precoMinimoGrupo) {
      toast.error(`Preço mínimo pra esse produto é ${formatBRL(precoMinimoGrupo)}.`);
      return;
    }
    const contas = contasParaPublicarGrupo(variantes);
    if (contas.length === 0) {
      toast.error("Marque em quais contas do Mercado Livre publicar.");
      return;
    }
    start(async () => {
      const res = await publicarGrupoMLVariasContas(
        token,
        contas,
        variantes.map((x) => x.id),
        v
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const falhas = res.resultados.filter((r) => !r.ok);
      if (falhas.length === 0)
        toast.success(`Publicado em ${res.resultados.length} conta(s), ${variantes.length} variações.`);
      else toast.error(`${res.resultados.length - falhas.length} publicado(s), ${falhas.length} falhou(aram): ${falhas[0].error}`);
      router.refresh();
    });
  }

  function pausarGrupo(variantes: CatalogoDropItemView[], mlContaId: string) {
    start(async () => {
      const res = await pausarGrupoML(token, mlContaId, variantes.map((v) => v.id));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Anúncio pausado.");
      router.refresh();
    });
  }

  function reativarGrupo(variantes: CatalogoDropItemView[], mlContaId: string) {
    start(async () => {
      const res = await reativarGrupoML(token, mlContaId, variantes.map((v) => v.id));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Anúncio reativado.");
      router.refresh();
    });
  }

  function atualizarPrecoGrupo(variantes: CatalogoDropItemView[], mlContaId: string) {
    const chave = variantes[0].id;
    const precoMinimoGrupo = Math.max(...variantes.map((v) => v.precoMinimo));
    const v = Number((precos[chave] ?? "").replace(",", "."));
    if (!Number.isFinite(v) || v < precoMinimoGrupo) {
      toast.error(`Preço mínimo pra esse produto é ${formatBRL(precoMinimoGrupo)}.`);
      return;
    }
    start(async () => {
      const res = await atualizarPrecoGrupoML(
        token,
        mlContaId,
        variantes.map((x) => x.id),
        v
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Preço atualizado.");
      router.refresh();
    });
  }

  function pedirExclusao(mlContaId: string, produtoIds: string[]) {
    setConfirmExcluir({ mlContaId, produtoIds });
  }

  function confirmarExclusao() {
    if (!confirmExcluir) return;
    const { mlContaId, produtoIds } = confirmExcluir;
    setConfirmExcluir(null);
    start(async () => {
      const res =
        produtoIds.length > 1
          ? await excluirGrupoAnuncioML(token, mlContaId, produtoIds)
          : await excluirAnuncioML(token, mlContaId, produtoIds[0]);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Anúncio excluído do Mercado Livre.");
      router.refresh();
    });
  }

  function abrirDetalhe(p: CatalogoDropItemView) {
    setDetalhe(p);
    setFormDetalhe({ nome: p.nome, descricao: p.descricao ?? "", imagens: p.imagens.join("\n") });
  }

  function salvarDetalhe() {
    if (!detalhe) return;
    start(async () => {
      const res = await salvarCustomizacaoProdutoSeller(token, detalhe.id, {
        nome: formDetalhe.nome,
        descricao: formDetalhe.descricao,
        imagens: formDetalhe.imagens.split("\n").map((u) => u.trim()).filter(Boolean),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Produto atualizado pro seu anúncio.");
      setDetalhe(null);
      router.refresh();
    });
  }

  function restaurarPadrao() {
    if (!detalhe) return;
    start(async () => {
      const res = await restaurarProdutoPadraoSeller(token, detalhe.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Restaurado pro cadastro padrão da PH.");
      setDetalhe(null);
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

  /** `indentado` = variação dentro de um grupo: publicar/pausar/preço são
   *  controlados no cabeçalho do grupo (publica todas de uma vez), não
   *  aqui — essa linha só mostra os dados da variação e "ver cadastro". */
  function linhaItem(p: CatalogoDropItemView, indentado: boolean) {
    const disponiveis = contasDisponiveis(p);
    const podeSelecionar = !indentado && p.mlCategoriaDefinida && disponiveis.length > 0;
    return (
      <div key={p.id} className={indentado ? "space-y-2 border-t border-neutral-50 py-2 pl-8" : "space-y-2 py-3"}>
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
            {!indentado && (
              <button
                type="button"
                onClick={() => abrirDetalhe(p)}
                className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-neutral-100"
                title="Ver cadastro completo"
              >
                {p.imagem_url ? (
                  <Image src={p.imagem_url} alt={p.nome} fill className="object-contain" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[9px] text-neutral-400">sem foto</div>
                )}
                {p.imagens.length > 1 && (
                  <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/70 px-1 text-[9px] font-medium text-white">
                    +{p.imagens.length - 1}
                  </span>
                )}
              </button>
            )}
            <button type="button" onClick={() => abrirDetalhe(p)} className="min-w-0 text-left">
              {!indentado && (
                <p className="truncate font-medium text-neutral-900 hover:text-brand hover:underline">
                  {p.nome}
                  {p.personalizado && <Badge tone="blue" className="ml-1.5 align-middle">personalizado</Badge>}
                </p>
              )}
              <p className="text-xs text-neutral-400 hover:text-neutral-600">
                {indentado ? (
                  <>
                    {p.variacao || `Variação ${p.sku.split("-").pop()}`} · SKU {p.sku} · {p.estoque_atual} em estoque
                  </>
                ) : (
                  <>
                    SKU {p.sku}
                    {p.categoria ? ` · ${p.categoria}` : ""} · {p.estoque_atual} em estoque · mín. {formatBRL(p.precoMinimo)}
                  </>
                )}
                {indentado && p.personalizado && <Badge tone="blue" className="ml-1.5 align-middle">personalizado</Badge>}
              </p>
              {!p.mlCategoriaDefinida && (
                <p className="text-xs text-yellow-600">Categoria do ML ainda não configurada — fale com a PH.</p>
              )}
            </button>
          </div>

          {!indentado && (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <input
                  value={precos[p.id] ?? ""}
                  onChange={(e) => setPrecos((s) => ({ ...s, [p.id]: e.target.value }))}
                  inputMode="decimal"
                  className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                />
                {disponiveis.length > 0 && p.mlCategoriaDefinida && (
                  <Button size="sm" onClick={() => publicar(p)} loading={pending} disabled={!mlConectado}>
                    <Upload size={13} /> Publicar
                  </Button>
                )}
              </div>
              {disponiveis.length > 1 && p.mlCategoriaDefinida && (
                <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                  {disponiveis.map((c) => (
                    <label key={c.id} className="flex items-center gap-1 text-xs text-neutral-500">
                      <input
                        type="checkbox"
                        checked={(contasEscolhidas[p.id] ?? new Set()).has(c.id)}
                        onChange={() => toggleConta(p.id, c.id)}
                        className="h-3.5 w-3.5 rounded border-neutral-300 text-brand"
                      />
                      {c.nickname ?? "Conta ML"}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {!indentado && p.anuncios.length > 0 && (
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
                  <Button size="sm" variant="outline" onClick={() => pedirExclusao(a.mlContaId, [p.id])} loading={pending}>
                    <Trash2 size={13} /> Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
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
        {grupos.map((variantes) => {
          if (variantes.length === 1) return linhaItem(variantes[0], false);
          const base = variantes[0];
          const chave = base.id;
          const aberto = produtosAbertos.has(chave);
          const estoqueTotal = variantes.reduce((s, p) => s + p.estoque_atual, 0);
          const precoMinimoGrupo = Math.max(...variantes.map((v) => v.precoMinimo));
          const disponiveisGrupo = contasDisponiveisGrupo(variantes);
          const anunciosGrupo = base.anuncios; // escritos juntos no mesmo ml_item_id — representativo do grupo inteiro
          return (
            <Fragment key={chave}>
              <div className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleProdutoAberto(chave)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronRight size={14} className={`shrink-0 text-neutral-400 transition-transform ${aberto ? "rotate-90" : ""}`} />
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                      {base.imagem_url ? (
                        <Image src={base.imagem_url} alt={base.nome} fill className="object-contain" unoptimized />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] text-neutral-400">sem foto</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900">{base.nome}</p>
                      <p className="text-xs text-neutral-400">
                        {variantes.length} variações (agrupadas no ML) · {estoqueTotal} em estoque · mín. {formatBRL(precoMinimoGrupo)}
                      </p>
                      {!base.mlCategoriaDefinida && (
                        <p className="text-xs text-yellow-600">Categoria do ML ainda não configurada — fale com a PH.</p>
                      )}
                    </div>
                  </button>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={precos[chave] ?? ""}
                        onChange={(e) => setPrecos((s) => ({ ...s, [chave]: e.target.value }))}
                        inputMode="decimal"
                        className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                      />
                      {disponiveisGrupo.length > 0 && base.mlCategoriaDefinida && (
                        <Button size="sm" onClick={() => publicarGrupo(variantes)} loading={pending} disabled={!mlConectado}>
                          <Upload size={13} /> Publicar variações
                        </Button>
                      )}
                    </div>
                    {disponiveisGrupo.length > 1 && base.mlCategoriaDefinida && (
                      <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                        {disponiveisGrupo.map((c) => (
                          <label key={c.id} className="flex items-center gap-1 text-xs text-neutral-500">
                            <input
                              type="checkbox"
                              checked={(contasEscolhidas[chave] ?? new Set()).has(c.id)}
                              onChange={() => toggleConta(chave, c.id)}
                              className="h-3.5 w-3.5 rounded border-neutral-300 text-brand"
                            />
                            {c.nickname ?? "Conta ML"}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {anunciosGrupo.length > 0 && (
                  <div className="ml-6 space-y-1.5">
                    {anunciosGrupo.map((a) => (
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
                              <Button size="sm" variant="outline" onClick={() => reativarGrupo(variantes, a.mlContaId)} loading={pending}>
                                <Play size={13} /> Reativar
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                                Anunciado (variações agrupadas)
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
                              <Button size="sm" variant="outline" onClick={() => atualizarPrecoGrupo(variantes, a.mlContaId)} loading={pending}>
                                Atualizar preço
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => pausarGrupo(variantes, a.mlContaId)} loading={pending}>
                                <Pause size={13} /> Pausar
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => pedirExclusao(a.mlContaId, variantes.map((v) => v.id))}
                            loading={pending}
                          >
                            <Trash2 size={13} /> Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {aberto && <div className="divide-y divide-neutral-50 pb-2">{variantes.map((p) => linhaItem(p, true))}</div>}
            </Fragment>
          );
        })}
      </div>

      <Modal
        open={!!detalhe}
        onClose={() => setDetalhe(null)}
        title="Detalhes do produto"
        size="lg"
        footer={
          <>
            {detalhe?.personalizado && (
              <Button variant="outline" onClick={restaurarPadrao} loading={pending} className="mr-auto">
                Restaurar padrão da PH
              </Button>
            )}
            <Button onClick={salvarDetalhe} loading={pending}>
              Salvar
            </Button>
          </>
        }
      >
        {detalhe && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2.5 text-sm">
              <span className="text-neutral-500">
                SKU {detalhe.sku}
                {detalhe.variacao ? ` · ${detalhe.variacao}` : ""} · {detalhe.estoque_atual} em estoque
              </span>
              <div className="flex items-center gap-4">
                {detalhe.custoReferencia != null && (
                  <span className="text-neutral-500">
                    Custo real: <strong className="text-neutral-800">{formatBRL(detalhe.custoReferencia)}</strong>
                  </span>
                )}
                <span className="text-neutral-500">
                  Sugerido (mín.): <strong className="text-neutral-800">{formatBRL(detalhe.precoMinimo)}</strong>
                </span>
                {detalhe.custoReferencia != null && (() => {
                  const revenda = Number((precos[detalhe.id] ?? "").replace(",", "."));
                  if (!Number.isFinite(revenda)) return null;
                  const margem = revenda - detalhe.custoReferencia;
                  const pct = detalhe.custoReferencia > 0 ? (margem / detalhe.custoReferencia) * 100 : 0;
                  return (
                    <span className={margem >= 0 ? "text-green-700" : "text-red-600"}>
                      Sua margem: <strong>{formatBRL(margem)}</strong> ({pct.toFixed(0)}%)
                    </span>
                  );
                })()}
              </div>
            </div>
            <p className="text-xs text-neutral-400">
              Editar aqui muda só como <strong>o seu</strong> anúncio aparece — o cadastro da PH (usado pelos outros
              sellers que revendem esse produto) não é alterado.
            </p>
            <Field label="Título do anúncio">
              <Input value={formDetalhe.nome} onChange={(e) => setFormDetalhe((s) => ({ ...s, nome: e.target.value }))} />
            </Field>
            <Field label="Descrição">
              <Textarea
                value={formDetalhe.descricao}
                onChange={(e) => setFormDetalhe((s) => ({ ...s, descricao: e.target.value }))}
                rows={4}
              />
            </Field>
            <Field label="Fotos" hint="Uma URL por linha — a primeira vira a capa.">
              <Textarea
                value={formDetalhe.imagens}
                onChange={(e) => setFormDetalhe((s) => ({ ...s, imagens: e.target.value }))}
                rows={3}
              />
              {formDetalhe.imagens.trim() && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formDetalhe.imagens
                    .split("\n")
                    .map((u) => u.trim())
                    .filter(Boolean)
                    .map((url, i) => (
                      <div key={i} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
                        <Image src={url} alt={`Foto ${i + 1}`} fill className="object-contain" unoptimized />
                      </div>
                    ))}
                </div>
              )}
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmExcluir}
        onClose={() => setConfirmExcluir(null)}
        onConfirm={confirmarExclusao}
        title="Excluir anúncio?"
        message="O anúncio é fechado no Mercado Livre (definitivo — não dá pra reabrir) e some da sua lista aqui. Você pode publicar de novo do zero depois, se quiser."
        confirmLabel="Excluir"
        danger
        loading={pending}
      />
    </div>
  );
}
