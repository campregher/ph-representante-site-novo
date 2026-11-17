import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, AlertTriangle, Store } from "lucide-react";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { pedidosDropSeller, type PedidoDrop } from "@/lib/sistema/seller-pedidos";
import { classificarUrgenciaEnvio, type UrgenciaEnvio } from "@/lib/sistema/dropshipping-pedido-envio-status";
import { formatDateTime } from "@/lib/sistema/format";
import SellerLocked from "@/components/drop/SellerLocked";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";
import PedidosFornecedorGroup, { type PedidoCombinavel } from "@/components/drop/PedidosFornecedorGroup";
import PedidosTabs from "@/components/drop/PedidosTabs";
import AutoRefresh from "@/components/drop/AutoRefresh";

/** Status REAL de envio do Mercado Livre (não o de repasse ao fornecedor) —
 *  rótulos best-effort, já que o formato exato nunca foi testado contra um
 *  envio de verdade (ver dropshipping-pedido-envio-status.ts). */
const ML_SHIPPING_LABEL: Record<string, { label: string; tone: "blue" | "green" | "red" | "neutral" }> = {
  pending: { label: "Aguardando despacho", tone: "neutral" },
  handling: { label: "Em preparação", tone: "neutral" },
  ready_to_ship: { label: "Pronto pra despachar", tone: "blue" },
  shipped: { label: "A caminho", tone: "blue" },
  delivered: { label: "Entregue", tone: "green" },
  not_delivered: { label: "Não entregue", tone: "red" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

const URGENCIA_LABEL: Record<UrgenciaEnvio, { label: string; tone: "red" | "yellow" | "blue" | "neutral" }> = {
  atrasado: { label: "Atrasado", tone: "red" },
  hoje: { label: "Enviar hoje", tone: "yellow" },
  em_breve: { label: "Nos próximos dias", tone: "blue" },
  sem_prazo: { label: "Sem prazo informado", tone: "neutral" },
};

export default async function DropDashboardPedidosPage() {
  const seller = await requireSeller();

  if (!seller.liberado) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-neutral-900">Pedidos</h1>
        <SellerLocked seller={seller} />
      </div>
    );
  }

  const pedidos = await pedidosDropSeller(seller.id);

  // 3 passos do fluxo de pós-venda, na ordem em que acontecem de verdade —
  // substitui as antigas abas por urgência (misturavam 3 critérios
  // diferentes ao mesmo tempo e confundiam mais do que ajudavam).
  const passo1EmitirNf = pedidos.filter((p) => p.status === "aguardando_nf");
  const passo2LiberarEtiqueta = pedidos.filter((p) => p.status === "pronto");
  const enviados = pedidos.filter((p) => p.status === "enviado");
  const devolucoes = pedidos.filter((p) => !!p.devolucaoStatus);

  return (
    <div className="max-w-3xl space-y-4">
      <AutoRefresh />
      <div>
        <h1 className="text-lg font-bold text-neutral-900">Pedidos</h1>
        <p className="text-sm text-neutral-500">
          Siga os passos abaixo pra cada venda: emitir a NF, liberar a etiqueta pro fornecedor e atualizar o status.
        </p>
      </div>

      <PedidosTabs
        tabs={[
          {
            id: "emitir_nf",
            label: "1. Emitir NF",
            count: passo1EmitirNf.length,
            content: <PassoEmitirNf pedidos={passo1EmitirNf} />,
          },
          {
            id: "liberar_etiqueta",
            label: "2. Liberar etiqueta pro fornecedor",
            count: passo2LiberarEtiqueta.length,
            content: <PassoLiberarEtiqueta pedidos={passo2LiberarEtiqueta} />,
          },
          {
            id: "enviados",
            label: "Enviados",
            count: enviados.length,
            content: (
              <Card>
                <CardBody className="p-0">
                  <BlocoPorConta pedidos={enviados} render={(lista) => <ListaPedidos pedidos={lista} mostrarEnvioML />} />
                </CardBody>
              </Card>
            ),
          },
          { id: "devolucoes", label: "Devoluções", count: devolucoes.length, content: <ListaDevolucoes pedidos={devolucoes} /> },
        ]}
      />
    </div>
  );
}

/** Passo 1 — nada pra baixar ainda, só o aviso + urgência de cada venda,
 *  pra priorizar qual NF emitir primeiro no Mercado Livre. */
function PassoEmitirNf({ pedidos }: { pedidos: PedidoDrop[] }) {
  return (
    <Card>
      <CardHeader
        title="Emita a NF do consumidor final no Mercado Livre"
        description="A etiqueta só fica pronta pra baixar depois que a nota fiscal é declarada lá no Mercado Livre."
      />
      <CardBody className="p-0">
        <BlocoPorConta pedidos={pedidos} render={(lista) => <ListaPedidos pedidos={lista} mostrarUrgencia mostrarEnvioML />} />
      </CardBody>
    </Card>
  );
}

/** Separa por conta do Mercado Livre que gerou a venda (um seller pode ter
 *  mais de uma conectada) — em vez de uma lista só, infinita, mistura de
 *  todas as contas juntas. Com 1 conta só, não faz diferença nenhuma
 *  mostrar o agrupamento — renderiza direto. */
function BlocoPorConta({ pedidos, render }: { pedidos: PedidoDrop[]; render: (pedidos: PedidoDrop[]) => ReactNode }) {
  if (pedidos.length === 0) return <p className="p-5 text-sm text-neutral-600">Nenhuma venda nessa situação.</p>;

  const grupos = new Map<string, PedidoDrop[]>();
  for (const p of pedidos) {
    const chave = p.contaNickname ?? "Conta ML";
    const lista = grupos.get(chave) ?? [];
    lista.push(p);
    grupos.set(chave, lista);
  }
  const gruposOrdenados = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  if (gruposOrdenados.length <= 1) return <>{render(pedidos)}</>;

  return (
    <div className="divide-y divide-neutral-100">
      {gruposOrdenados.map(([conta, lista]) => (
        <details key={conta} open className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 bg-neutral-50 px-5 py-2.5 hover:bg-neutral-100">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <Store size={13} className="text-neutral-400" /> {conta}
            </span>
            <Badge tone="neutral">{lista.length}</Badge>
          </summary>
          {render(lista)}
        </details>
      ))}
    </div>
  );
}

/** Passo 2 — os 2 sub-passos (baixar o pacote, depois marcar como enviado)
 *  já ficam dentro do próprio PedidosFornecedorGroup, numerados ali. */
function PassoLiberarEtiqueta({ pedidos }: { pedidos: PedidoDrop[] }) {
  const gruposProntos = agruparPorFornecedor(pedidos);
  if (gruposProntos.length === 0) {
    return (
      <Card>
        <CardBody className="text-sm text-neutral-600">Nenhuma venda com etiqueta liberada pra enviar ao fornecedor agora.</CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader
        title="Baixe o pacote e mande pro fornecedor"
        description="① Selecione os pedidos de um fornecedor e baixe um único pacote (etiquetas, notas fiscais e planilha). ② Depois de mandar no grupo de WhatsApp dele, marque como enviado."
      />
      <CardBody className="space-y-3">
        {gruposProntos.map((g) => (
          <PedidosFornecedorGroup key={g.fornecedorNome} fornecedorNome={g.fornecedorNome} pedidos={g.pedidos} />
        ))}
      </CardBody>
    </Card>
  );
}

function ListaPedidos({
  pedidos,
  mostrarUrgencia = false,
  mostrarEnvioML = false,
}: {
  pedidos: PedidoDrop[];
  mostrarUrgencia?: boolean;
  mostrarEnvioML?: boolean;
}) {
  if (pedidos.length === 0) {
    return <p className="p-5 text-sm text-neutral-600">Nenhuma venda nessa situação.</p>;
  }
  return (
    <div className="divide-y divide-neutral-100">
      {pedidos.map((p) => {
        const urgencia = mostrarUrgencia ? URGENCIA_LABEL[classificarUrgenciaEnvio(p.prazoEnvio)] : null;
        const envioMl = mostrarEnvioML && p.mlShippingStatus ? ML_SHIPPING_LABEL[p.mlShippingStatus] : null;
        const totalCaixas = p.itens.reduce((s, it) => s + it.caixas, 0);
        return (
          <Link
            key={p.id}
            href={`/drop/dashboard/pedidos/${p.id}`}
            className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-neutral-50"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-neutral-900">
                #{p.numero} — {p.itens.map((it) => `${it.quantidade}x ${it.nome}`).join(", ")}
              </p>
              <p className="mt-0.5 text-xs text-neutral-400">
                {formatDateTime(p.createdAt)}
                {p.entregaCidade ? ` · entrega em ${p.entregaCidade}/${p.entregaUf ?? ""}` : ""}
                {totalCaixas !== p.itens.reduce((s, it) => s + it.quantidade, 0) ? ` · enviar ${totalCaixas} caixa(s)` : ""}
              </p>
              {(urgencia || envioMl) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {urgencia && <Badge tone={urgencia.tone}>{urgencia.label}</Badge>}
                  {envioMl && <Badge tone={envioMl.tone}>{envioMl.label}</Badge>}
                </div>
              )}
            </div>
            <ChevronRight size={16} className="shrink-0 text-neutral-300" />
          </Link>
        );
      })}
    </div>
  );
}

function ListaDevolucoes({ pedidos }: { pedidos: PedidoDrop[] }) {
  return (
    <Card>
      <CardHeader
        title="Devoluções"
        description="Pedidos com reclamação ou devolução aberta no Mercado Livre — configuração de garantias e motivos chega em breve; por enquanto é só acompanhamento."
      />
      <CardBody className="p-0">
        {pedidos.length === 0 ? (
          <p className="p-5 text-sm text-neutral-600">Nenhuma devolução em andamento.</p>
        ) : (
          <BlocoPorConta pedidos={pedidos} render={LinhasDevolucao} />
        )}
      </CardBody>
    </Card>
  );
}

function LinhasDevolucao(pedidos: PedidoDrop[]) {
  return (
    <div className="divide-y divide-neutral-100">
      {pedidos.map((p) => (
        <Link
          key={p.id}
          href={`/drop/dashboard/pedidos/${p.id}`}
          className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-neutral-50"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold text-neutral-900">
              #{p.numero} — {p.itens.map((it) => `${it.quantidade}x ${it.nome}`).join(", ")}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle size={12} /> {p.devolucaoMotivo ?? p.devolucaoStatus}
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-neutral-300" />
        </Link>
      ))}
    </div>
  );
}

function agruparPorFornecedor(pedidos: PedidoDrop[]): { fornecedorNome: string; pedidos: PedidoCombinavel[] }[] {
  const grupos = new Map<string, PedidoCombinavel[]>();
  for (const p of pedidos) {
    if (!p.fornecedorNome) continue;
    const totalCaixas = p.itens.reduce((s, it) => s + it.caixas, 0);
    const item: PedidoCombinavel = {
      id: p.id,
      numero: p.numero,
      resumo: p.itens.map((it) => `${it.quantidade}x ${it.nome}`).join(", "),
      totalCaixas,
      envioMl: p.mlShippingStatus ? ML_SHIPPING_LABEL[p.mlShippingStatus] ?? null : null,
    };
    const lista = grupos.get(p.fornecedorNome) ?? [];
    lista.push(item);
    grupos.set(p.fornecedorNome, lista);
  }
  return [...grupos.entries()]
    .map(([fornecedorNome, lista]) => ({ fornecedorNome, pedidos: lista.sort((a, b) => a.numero - b.numero) }))
    .sort((a, b) => a.fornecedorNome.localeCompare(b.fornecedorNome));
}
