"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, ExternalLink, Pause, Play, Settings2, Trash2, Upload, Wallet } from "lucide-react";
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
  consultarMetodosEnvioML,
  consultarRecebimentoML,
} from "@/lib/sistema/actions/seller-ml-catalogo";
import {
  salvarCustomizacaoProdutoSeller,
  restaurarProdutoPadraoSeller,
  aplicarConfigEnvioEmMassa,
} from "@/lib/sistema/actions/seller-produto-customizacao";
import { formatBRL } from "@/lib/sistema/format";
import { ML_METODO_ENVIO_OPTIONS, ML_TIPO_ANUNCIO_OPTIONS } from "@/lib/sistema/schemas";
import { Button } from "@/components/sistema/ui/Button";
import { Modal, ConfirmDialog } from "@/components/sistema/ui/Modal";
import { Field, Input, Textarea, Select } from "@/components/sistema/ui/Field";
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
  transporteAceito: string[];
  metodoEnvio: string | null;
  tipoAnuncio: string | null;
}

export interface MlContaView {
  id: string;
  nickname: string | null;
}

const CARD = "rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300";
const PRECO_INPUT_CLASS = "w-28 text-sm";

/** "Você recebe" igual à Central de Vendedores do Mercado Livre — comissão
 *  sempre calcula (preço + categoria). Frete só entra na conta quando o
 *  método de envio é Mercado Envios/Flex (me2) — aí sim existe um "frete
 *  grátis" que o ML gerencia e que o seller banca, e só dá pra saber o
 *  valor depois que o anúncio existe de verdade no ML. Com Correios/
 *  Entrega Direta (fora da rede do Mercado Envios) não tem frete grátis
 *  nenhum: o seller cobra e paga o envio por fora, o ML nem participa
 *  disso — por isso nunca aparece "calculado após publicar" nesse caso.
 *  `metodoEnvioOverride` deixa o preview (antes de salvar "Detalhes do
 *  produto") reagir ao que está selecionado no campo, não só ao que já
 *  está salvo. Busca sob demanda (um componente por linha) pra não
 *  disparar uma chamada ao ML por produto do catálogo todo. */
function RecebimentoLinha({
  token,
  mlContaId,
  produtoId,
  preco,
  custoReferencia,
  metodoEnvioOverride,
}: {
  token: string;
  mlContaId: string;
  produtoId: string;
  preco: number;
  /** Custo real de fábrica, quando conhecido — dá pra sinalizar prejuízo
   *  (recebe líquido, já descontada comissão/frete, menor que o custo). */
  custoReferencia?: number | null;
  metodoEnvioOverride?: string;
}) {
  const [estado, setEstado] = useState<
    "carregando" | "erro" | { comissao: number; freteAplicavel: boolean; frete: number | null; recebe: number }
  >("carregando");

  useEffect(() => {
    let vivo = true;
    consultarRecebimentoML(token, mlContaId, produtoId, preco, metodoEnvioOverride).then((res) => {
      if (!vivo) return;
      setEstado(res.ok ? { comissao: res.comissao, freteAplicavel: res.freteAplicavel, frete: res.frete, recebe: res.recebe } : "erro");
    });
    return () => {
      vivo = false;
    };
  }, [token, mlContaId, produtoId, preco, metodoEnvioOverride]);

  if (estado === "erro") return null;
  if (estado === "carregando") return <p className="text-xs text-neutral-400">Calculando quanto você recebe…</p>;
  const detalheFrete = !estado.freteAplicavel
    ? "frete por sua conta, fora do Mercado Envios"
    : estado.frete != null
      ? `frete grátis ${formatBRL(estado.frete)}`
      : "frete grátis calculado após publicar";
  const margem = custoReferencia != null ? estado.recebe - custoReferencia : null;
  const prejuizo = margem != null && margem < 0;
  return (
    <div
      className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
        prejuizo ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"
      }`}
    >
      {prejuizo ? (
        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-600" />
      ) : (
        <Wallet size={13} className="mt-0.5 shrink-0 text-green-600" />
      )}
      <span>
        Você recebe{" "}
        <strong className={prejuizo ? "text-red-900" : "text-green-900"}>{formatBRL(estado.recebe)}</strong>{" "}
        <span className={prejuizo ? "text-red-700/80" : "text-green-700/80"}>
          (comissão {formatBRL(estado.comissao)} · {detalheFrete})
        </span>
        {margem != null && (
          <>
            {" "}
            <strong className={prejuizo ? "text-red-900" : "text-green-900"}>
              {prejuizo ? `· Prejuízo de ${formatBRL(Math.abs(margem))}` : `· Margem de ${formatBRL(margem)}`}
            </strong>
          </>
        )}
      </span>
    </div>
  );
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
  const [formDetalhe, setFormDetalhe] = useState({ nome: "", descricao: "", imagens: "", metodoEnvio: "", tipoAnuncio: "" });
  const [confirmExcluir, setConfirmExcluir] = useState<{ mlContaId: string; produtoIds: string[] } | null>(null);
  // null = ainda não sabe (checando) — nesse caso mostra tudo que o produto
  // aceita (não bloqueia a escolha); depois de checar, vira a interseção do
  // que está ATIVO em todas as contas do ML conectadas desse seller agora
  // (ver consultarMetodosEnvioML) — a validação que de fato importa roda de
  // novo no servidor, por conta, no momento de publicar.
  const [metodosAtivosML, setMetodosAtivosML] = useState<string[] | null>(null);
  const [carregandoMetodosEnvio, setCarregandoMetodosEnvio] = useState(false);
  // Edição em massa (método de envio + tipo de anúncio) pros selecionados,
  // antes de publicar em lote — ver abrirEdicaoLote/aplicarEdicaoLote.
  const [loteModalAberto, setLoteModalAberto] = useState(false);
  const [loteMetodoEnvio, setLoteMetodoEnvio] = useState("");
  const [loteTipoAnuncio, setLoteTipoAnuncio] = useState("");
  const [loteMetodosAtivos, setLoteMetodosAtivos] = useState<string[] | null>(null);
  const [loteCarregando, setLoteCarregando] = useState(false);

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

  const itensSelecionados = useMemo(
    () => publicaveis.filter((p) => selecionados.has(p.id)),
    [publicaveis, selecionados]
  );

  /** Toda chave que tem checkbox na tela — produto avulso publicável ou
   *  grupo de variações (chave = id da primeira variação) — pra "Selecionar
   *  todos" marcar/desmarcar de uma vez. */
  const chavesSelecionaveis = useMemo(() => {
    const chaves = publicaveis.map((p) => p.id);
    for (const variantes of grupos) if (variantes.length > 1) chaves.push(variantes[0].id);
    return chaves;
  }, [publicaveis, grupos]);

  const todosSelecionados = chavesSelecionaveis.length > 0 && chavesSelecionaveis.every((k) => selecionados.has(k));

  function alternarSelecionarTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(chavesSelecionaveis));
  }

  /** Pra "Editar em massa" (método de envio/tipo de anúncio) — diferente de
   *  `itensSelecionados` (só produtos avulsos, usado pra publicar em lote),
   *  aqui um grupo marcado (checkbox no cabeçalho do grupo, chave = id da
   *  primeira variação) expande pra TODAS as variações dele, já que o
   *  método de envio é cadastro por produto (ver seller-ml-catalogo.ts),
   *  não por grupo. */
  const itensParaEdicaoEmMassa = useMemo(() => {
    const resultado: CatalogoDropItemView[] = [];
    for (const chave of selecionados) {
      const grupo = grupos.find((g) => g.length > 1 && g[0].id === chave);
      if (grupo) resultado.push(...grupo);
      else {
        const item = itens.find((p) => p.id === chave);
        if (item) resultado.push(item);
      }
    }
    return resultado;
  }, [selecionados, grupos, itens]);

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
    if (!item.metodoEnvio) {
      toast.error("Cadastre o método de envio desse produto antes de publicar.");
      abrirDetalhe(item);
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
    const base = variantes[0];
    const precoMinimoGrupo = Math.max(...variantes.map((v) => v.precoMinimo));
    const v = Number((precos[base.id] ?? "").replace(",", "."));
    if (!Number.isFinite(v) || v < precoMinimoGrupo) {
      toast.error(`Preço mínimo pra esse produto é ${formatBRL(precoMinimoGrupo)}.`);
      return;
    }
    if (!variantes.some((p) => p.metodoEnvio)) {
      toast.error("Cadastre o método de envio desse produto antes de publicar.");
      abrirDetalhe(base);
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
    setFormDetalhe({
      nome: p.nome,
      descricao: p.descricao ?? "",
      imagens: p.imagens.join("\n"),
      metodoEnvio: p.metodoEnvio ?? "",
      tipoAnuncio: p.tipoAnuncio ?? "",
    });
    setMetodosAtivosML(null);
    if (mlContas.length === 0) return;
    setCarregandoMetodosEnvio(true);
    (async () => {
      const resultados = await Promise.all(mlContas.map((c) => consultarMetodosEnvioML(token, c.id)));
      const ok = resultados.filter((r) => r.ok) as { ok: true; metodos: string[] }[];
      setCarregandoMetodosEnvio(false);
      const ativos = ok.length === 0 ? [] : ok[0].metodos.filter((m) => ok.every((r) => r.metodos.includes(m)));
      setMetodosAtivosML(ativos);
      // o que já tinha sido cadastrado pode ter deixado de estar ativo no ML
      // desde então — não deixa uma opção que nem aparece mais selecionada.
      setFormDetalhe((s) => (s.metodoEnvio && !ativos.includes(s.metodoEnvio) ? { ...s, metodoEnvio: "" } : s));
    })();
  }

  /** Só o que o produto aceita (cadastro do admin) E — quando já sabemos —
   *  está de fato ativo agora no Mercado Livre da conta conectada (ver
   *  abrirDetalhe). Enquanto ainda não sabe (`null`), mostra tudo que o
   *  produto aceita, pra não travar a tela esperando a API do ML. */
  function metodosEnvioDisponiveis(p: CatalogoDropItemView) {
    const doProduto = ML_METODO_ENVIO_OPTIONS.filter((o) => p.transporteAceito.includes(o.value));
    if (metodosAtivosML == null) return doProduto;
    return doProduto.filter((o) => metodosAtivosML.includes(o.value));
  }

  function salvarDetalhe() {
    if (!detalhe) return;
    if (metodosEnvioDisponiveis(detalhe).length > 0 && !formDetalhe.metodoEnvio) {
      toast.error("Escolha o método de envio desse produto.");
      return;
    }
    start(async () => {
      const res = await salvarCustomizacaoProdutoSeller(token, detalhe.id, {
        nome: formDetalhe.nome,
        descricao: formDetalhe.descricao,
        imagens: formDetalhe.imagens.split("\n").map((u) => u.trim()).filter(Boolean),
        metodoEnvio: formDetalhe.metodoEnvio,
        tipoAnuncio: formDetalhe.tipoAnuncio,
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

  /** Checa o que está ativo na conta de lote escolhida, pra montar as opções
   *  do modal de edição em massa — mesma ideia do abrirDetalhe, mas pra 1
   *  conta só (a que vai receber a publicação em lote), não a interseção de
   *  todas. */
  function abrirEdicaoLote() {
    setLoteMetodoEnvio("");
    setLoteTipoAnuncio("");
    setLoteMetodosAtivos(null);
    setLoteModalAberto(true);
    if (!contaLote) return;
    setLoteCarregando(true);
    consultarMetodosEnvioML(token, contaLote).then((res) => {
      setLoteCarregando(false);
      setLoteMetodosAtivos(res.ok ? res.metodos : []);
    });
  }

  /** Só os métodos aceitos por TODOS os produtos selecionados ao mesmo tempo
   *  (interseção) e, quando já sabemos, ativos na conta escolhida. */
  function metodosEnvioDisponiveisLote() {
    const comuns = ML_METODO_ENVIO_OPTIONS.filter((o) => itensParaEdicaoEmMassa.every((p) => p.transporteAceito.includes(o.value)));
    if (loteMetodosAtivos == null) return comuns;
    return comuns.filter((o) => loteMetodosAtivos.includes(o.value));
  }

  function aplicarEdicaoLote() {
    if (!loteMetodoEnvio) {
      toast.error("Escolha o método de envio.");
      return;
    }
    const ids = itensParaEdicaoEmMassa.map((p) => p.id);
    if (ids.length === 0) return;
    start(async () => {
      const res = await aplicarConfigEnvioEmMassa(token, ids, { metodoEnvio: loteMetodoEnvio, tipoAnuncio: loteTipoAnuncio });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Método de envio aplicado a ${ids.length} produto(s).`);
      setLoteModalAberto(false);
      router.refresh();
    });
  }

  function publicarSelecionados() {
    if (!contaLote) {
      toast.error("Escolha em qual conta publicar.");
      return;
    }
    if (itensSelecionados.length === 0) return;
    const payload: { produtoId: string; precoRevenda: number }[] = [];
    for (const item of itensSelecionados) {
      const preco = precoValido(item);
      if (preco == null) {
        toast.error(`${item.nome}: preço mínimo é ${formatBRL(item.precoMinimo)}.`);
        return;
      }
      if (!item.metodoEnvio) {
        toast.error(`${item.nome}: cadastre o método de envio antes de publicar.`);
        abrirDetalhe(item);
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

  /** Linha de status de um anúncio já publicado (status, ações, recebimento),
   *  reaproveitada tanto pro produto avulso quanto pro cabeçalho do grupo.
   *  "Atualizar preço" fica disponível ativo OU pausado — editar o preço
   *  não devia depender de reativar primeiro. */
  function linhaAnuncio(
    a: AnuncioView,
    produtoId: string,
    custoReferencia: number | null,
    onPausar: () => void,
    onReativar: () => void,
    onAtualizarPreco: () => void,
    onExcluir: () => void,
    labelAnunciado = "Anunciado"
  ) {
    return (
      <div key={a.mlContaId} className="space-y-1.5 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-neutral-600">{a.contaNickname ?? "Conta ML"}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {a.status === "paused" ? (
              <Badge tone="neutral">Pausado</Badge>
            ) : (
              <>
                <Badge tone="green">{labelAnunciado}</Badge>
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
              </>
            )}
            <Button size="sm" variant="outline" onClick={onAtualizarPreco} loading={pending}>
              Atualizar preço
            </Button>
            {a.status === "paused" ? (
              <Button size="sm" variant="outline" onClick={onReativar} loading={pending}>
                <Play size={13} /> Reativar
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onPausar} loading={pending}>
                <Pause size={13} /> Pausar
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onExcluir} loading={pending}>
              <Trash2 size={13} /> Excluir
            </Button>
          </div>
        </div>
        <RecebimentoLinha
          token={token}
          mlContaId={a.mlContaId}
          produtoId={produtoId}
          preco={a.precoRevenda}
          custoReferencia={custoReferencia}
        />
      </div>
    );
  }

  /** `indentado` = variação dentro de um grupo: publicar/pausar/preço são
   *  controlados no cabeçalho do grupo (publica todas de uma vez), não
   *  aqui — essa linha só mostra os dados da variação e "ver cadastro". */
  function linhaItem(p: CatalogoDropItemView, indentado: boolean) {
    const disponiveis = contasDisponiveis(p);
    const podeSelecionar = !indentado && p.mlCategoriaDefinida && disponiveis.length > 0;
    if (indentado) {
      return (
        <div key={p.id} className="flex items-center gap-2 border-t border-neutral-100 px-1 py-2.5 first:border-t-0">
          <button type="button" onClick={() => abrirDetalhe(p)} className="min-w-0 flex-1 text-left">
            <p className="text-xs text-neutral-500 hover:text-brand">
              <span className="font-medium text-neutral-700">{p.variacao || `Variação ${p.sku.split("-").pop()}`}</span>
              {" "}· SKU {p.sku} · {p.estoque_atual} em estoque
              {p.personalizado && (
                <Badge tone="blue" className="ml-1.5 align-middle">
                  personalizado
                </Badge>
              )}
            </p>
          </button>
        </div>
      );
    }
    return (
      <div key={p.id} className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {podeSelecionar && (
              <input
                type="checkbox"
                checked={selecionados.has(p.id)}
                onChange={() => toggleSelecionado(p.id)}
                disabled={!mlConectado}
                className="mt-2 h-4 w-4 rounded border-neutral-300 text-brand"
              />
            )}
            <button
              type="button"
              onClick={() => abrirDetalhe(p)}
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100"
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
            <button type="button" onClick={() => abrirDetalhe(p)} className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold text-neutral-900 hover:text-brand">
                {p.nome}
                {p.personalizado && (
                  <Badge tone="blue" className="ml-1.5 align-middle">
                    personalizado
                  </Badge>
                )}
              </p>
              <p className="mt-0.5 text-xs text-neutral-400">
                SKU {p.sku}
                {p.categoria ? ` · ${p.categoria}` : ""} · {p.estoque_atual} em estoque · mín. {formatBRL(p.precoMinimo)}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {!p.mlCategoriaDefinida && <Badge tone="yellow">Categoria do ML pendente — fale com a PH</Badge>}
                {p.mlCategoriaDefinida && !p.metodoEnvio && <Badge tone="yellow">Cadastre o método de envio</Badge>}
              </div>
            </button>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <Input
                value={precos[p.id] ?? ""}
                onChange={(e) => setPrecos((s) => ({ ...s, [p.id]: e.target.value }))}
                inputMode="decimal"
                className={PRECO_INPUT_CLASS}
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
        </div>

        {p.anuncios.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
            {p.anuncios.map((a) =>
              linhaAnuncio(
                a,
                p.id,
                p.custoReferencia,
                () => pausar(p, a.mlContaId),
                () => reativar(p, a.mlContaId),
                () => atualizarPreco(p, a.mlContaId),
                () => pedirExclusao(a.mlContaId, [p.id])
              )
            )}
          </div>
        )}
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 py-10 text-center">
        <p className="text-sm text-neutral-500">Nenhum produto disponível pra venda no momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!mlConectado && (
        <div className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800">
          Conecte uma conta do Mercado Livre em Integração pra poder publicar anúncios.
        </div>
      )}
      {chavesSelecionaveis.length > 0 && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            selecionados.size > 0 ? "border-brand/15 bg-brand/5" : "border-neutral-200 bg-white"
          }`}
        >
          <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
            <input
              type="checkbox"
              checked={todosSelecionados}
              onChange={alternarSelecionarTodos}
              disabled={!mlConectado}
              className="h-4 w-4 rounded border-neutral-300 text-brand"
            />
            {selecionados.size > 0 ? `${selecionados.size} selecionado(s)` : `Selecionar todos (${chavesSelecionaveis.length})`}
          </label>
          {selecionados.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={contaLote}
                onChange={(e) => setContaLote(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
              >
                {mlContas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nickname ?? "Conta ML"}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={abrirEdicaoLote} disabled={!mlConectado}>
                <Settings2 size={14} /> Editar em massa
              </Button>
              {itensSelecionados.length > 0 && (
                <Button size="sm" onClick={publicarSelecionados} loading={pending} disabled={!mlConectado}>
                  <Upload size={14} /> Publicar selecionados
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <div className="space-y-3">
        {grupos.map((variantes) => {
          if (variantes.length === 1) return linhaItem(variantes[0], false);
          const base = variantes[0];
          const chave = base.id;
          const aberto = produtosAbertos.has(chave);
          const estoqueTotal = variantes.reduce((s, p) => s + p.estoque_atual, 0);
          const precoMinimoGrupo = Math.max(...variantes.map((v) => v.precoMinimo));
          const custosGrupo = variantes.map((v) => v.custoReferencia).filter((c): c is number => c != null);
          // pior caso entre as variações — não deixa passar batido uma
          // variação mais cara que as outras.
          const custoMaxGrupo = custosGrupo.length > 0 ? Math.max(...custosGrupo) : null;
          const disponiveisGrupo = contasDisponiveisGrupo(variantes);
          const anunciosGrupo = base.anuncios; // escritos juntos no mesmo ml_item_id — representativo do grupo inteiro
          return (
            <div key={chave} className={CARD}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selecionados.has(chave)}
                    onChange={() => toggleSelecionado(chave)}
                    disabled={!mlConectado}
                    title="Marcar pra editar em massa (método de envio/tipo de anúncio)"
                    className="mt-5 h-4 w-4 shrink-0 rounded border-neutral-300 text-brand"
                  />
                  <button
                    type="button"
                    onClick={() => toggleProdutoAberto(chave)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <ChevronRight
                      size={16}
                      className={`mt-4 shrink-0 text-neutral-400 transition-transform ${aberto ? "rotate-90" : ""}`}
                    />
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                    {base.imagem_url ? (
                      <Image src={base.imagem_url} alt={base.nome} fill className="object-contain" unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[9px] text-neutral-400">sem foto</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{base.nome}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {estoqueTotal} em estoque · mín. {formatBRL(precoMinimoGrupo)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="purple">{variantes.length} variações agrupadas no ML</Badge>
                      {!base.mlCategoriaDefinida && <Badge tone="yellow">Categoria do ML pendente — fale com a PH</Badge>}
                      {base.mlCategoriaDefinida && !variantes.some((p) => p.metodoEnvio) && (
                        <Badge tone="yellow">Cadastre o método de envio</Badge>
                      )}
                    </div>
                  </div>
                </button>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={precos[chave] ?? ""}
                      onChange={(e) => setPrecos((s) => ({ ...s, [chave]: e.target.value }))}
                      inputMode="decimal"
                      className={PRECO_INPUT_CLASS}
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
                <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                  {anunciosGrupo.map((a) =>
                    linhaAnuncio(
                      a,
                      base.id,
                      custoMaxGrupo,
                      () => pausarGrupo(variantes, a.mlContaId),
                      () => reativarGrupo(variantes, a.mlContaId),
                      () => atualizarPrecoGrupo(variantes, a.mlContaId),
                      () => pedirExclusao(a.mlContaId, variantes.map((v) => v.id)),
                      "Anunciado (variações agrupadas)"
                    )
                  )}
                </div>
              )}

              {aberto && <div className="mt-2 border-t border-neutral-100 pl-9">{variantes.map((p) => linhaItem(p, true))}</div>}
            </div>
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
                    <span className={margem >= 0 ? "text-green-700" : "text-red-600"} title="Preço - custo, sem descontar comissão/frete do Mercado Livre">
                      Margem bruta: <strong>{formatBRL(margem)}</strong> ({pct.toFixed(0)}%)
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
            <Field
              label="Método de envio"
              required={metodosEnvioDisponiveis(detalhe).length > 0}
              hint={
                carregandoMetodosEnvio
                  ? "Checando o que está ativo agora na sua conta do Mercado Livre…"
                  : metodosEnvioDisponiveis(detalhe).length === 0
                    ? mlContas.length === 0
                      ? "Conecte uma conta do Mercado Livre pra poder escolher o método de envio."
                      : "Nenhum método de envio que esse produto aceita está ativo agora na(s) sua(s) conta(s) do Mercado Livre — ative em Mercado Envios/Flex no painel do ML, ou fale com a PH se o produto aceitar o método certo."
                    : "Mostra só o que está ativo agora na sua conta do Mercado Livre e que esse produto aceita."
              }
            >
              <Select
                value={formDetalhe.metodoEnvio}
                onChange={(e) => setFormDetalhe((s) => ({ ...s, metodoEnvio: e.target.value }))}
                disabled={carregandoMetodosEnvio || metodosEnvioDisponiveis(detalhe).length === 0}
              >
                <option value="">Selecione…</option>
                {metodosEnvioDisponiveis(detalhe).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Tipo de anúncio"
              hint="Clássico tem comissão menor; Premium dá mais exposição no Mercado Livre. Sem escolher, publica como Premium."
            >
              <Select
                value={formDetalhe.tipoAnuncio || "gold_pro"}
                onChange={(e) => setFormDetalhe((s) => ({ ...s, tipoAnuncio: e.target.value }))}
              >
                {ML_TIPO_ANUNCIO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            {detalhe.anuncios.length === 0 &&
              mlContas.length > 0 &&
              !!formDetalhe.metodoEnvio &&
              (() => {
                const preco = Number((precos[detalhe.id] ?? "").replace(",", "."));
                if (!Number.isFinite(preco) || preco <= 0) return null;
                return (
                  <RecebimentoLinha
                    token={token}
                    mlContaId={mlContas[0].id}
                    produtoId={detalhe.id}
                    preco={preco}
                    custoReferencia={detalhe.custoReferencia}
                    metodoEnvioOverride={formDetalhe.metodoEnvio}
                  />
                );
              })()}
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

      <Modal
        open={loteModalAberto}
        onClose={() => setLoteModalAberto(false)}
        title="Editar em massa"
        footer={
          <Button onClick={aplicarEdicaoLote} loading={pending}>
            Aplicar a {itensParaEdicaoEmMassa.length} produto(s)
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-neutral-500">
            Aplica o mesmo método de envio e tipo de anúncio pros <strong>{itensParaEdicaoEmMassa.length}</strong> produtos
            dentro do que você marcou (grupo de variações conta todas elas) — assim não precisa abrir &ldquo;Detalhes&rdquo; de
            cada um antes de publicar em lote. Cada produto continua podendo ser editado individualmente depois.
          </p>
          <Field
            label="Método de envio"
            required
            hint={
              loteCarregando
                ? "Checando o que está ativo na conta escolhida…"
                : metodosEnvioDisponiveisLote().length === 0
                  ? "Nenhum método bate em todos os produtos selecionados ao mesmo tempo nessa conta — tente selecionar menos produtos ou trocar a conta."
                  : "Só os métodos aceitos por todos os selecionados e ativos na conta escolhida pra publicar."
            }
          >
            <Select
              value={loteMetodoEnvio}
              onChange={(e) => setLoteMetodoEnvio(e.target.value)}
              disabled={loteCarregando || metodosEnvioDisponiveisLote().length === 0}
            >
              <option value="">Selecione…</option>
              {metodosEnvioDisponiveisLote().map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo de anúncio" hint="Sem escolher, publica todos como Premium.">
            <Select value={loteTipoAnuncio || "gold_pro"} onChange={(e) => setLoteTipoAnuncio(e.target.value)}>
              {ML_TIPO_ANUNCIO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
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
