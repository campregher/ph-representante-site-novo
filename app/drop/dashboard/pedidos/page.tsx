import Link from "next/link";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { pedidosDropSeller, type PedidoDrop } from "@/lib/sistema/seller-pedidos";
import { classificarUrgenciaEnvio } from "@/lib/sistema/dropshipping-pedido-envio-status";
import { formatDateTime } from "@/lib/sistema/format";
import SellerLocked from "@/components/drop/SellerLocked";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";
import PedidosFornecedorGroup, { type PedidoCombinavel } from "@/components/drop/PedidosFornecedorGroup";
import PedidosTabs from "@/components/drop/PedidosTabs";
import AutoRefresh from "@/components/drop/AutoRefresh";

const STATUS_LABEL = {
  aguardando_nf: { label: "Aguardando você emitir a NF no Mercado Livre", tone: "yellow" as const },
  pronto: { label: "Pronto pra enviar ao fornecedor", tone: "green" as const },
  enviado: { label: "Enviado ao fornecedor", tone: "blue" as const },
  cancelado: { label: "Cancelado", tone: "neutral" as const },
};

/** Status REAL de envio do Mercado Livre (não o de repasse ao fornecedor
 *  acima) — rótulos best-effort, já que o formato exato nunca foi testado
 *  contra um envio de verdade (ver dropshipping-pedido-envio-status.ts).
 *  Qualquer valor fora dessa lista cai no fallback (mostra o texto cru). */
const ML_SHIPPING_LABEL: Record<string, { label: string; tone: "blue" | "green" | "red" | "neutral" }> = {
  pending: { label: "Aguardando despacho", tone: "neutral" },
  handling: { label: "Em preparação", tone: "neutral" },
  ready_to_ship: { label: "Pronto pra despachar", tone: "blue" },
  shipped: { label: "A caminho", tone: "blue" },
  delivered: { label: "Entregue", tone: "green" },
  not_delivered: { label: "Não entregue", tone: "red" },
  cancelled: { label: "Cancelado", tone: "neutral" },
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

  // Mesmas 3 faixas de urgência que o próprio Mercado Livre usa no painel
  // de vendas dele ("Envios de hoje"/"Próximos dias"/atrasado em destaque) —
  // "sem prazo informado" entra em "Próximos dias" (ver aviso no topo de
  // dropshipping-pedido-envio-status.ts: esse campo ainda não foi
  // confirmado contra um envio real, pode estar vindo null por enquanto).
  const aEnviar = pedidos.filter((p) => p.status === "aguardando_nf" || p.status === "pronto");
  const atrasados = aEnviar.filter((p) => classificarUrgenciaEnvio(p.prazoEnvio) === "atrasado");
  const hoje = aEnviar.filter((p) => classificarUrgenciaEnvio(p.prazoEnvio) === "hoje");
  const proximosDias = aEnviar.filter((p) => {
    const u = classificarUrgenciaEnvio(p.prazoEnvio);
    return u === "em_breve" || u === "sem_prazo";
  });
  const enviados = pedidos.filter((p) => p.status === "enviado");
  const devolucoes = pedidos.filter((p) => !!p.devolucaoStatus);

  return (
    <div className="max-w-3xl space-y-4">
      <AutoRefresh />
      <div>
        <h1 className="text-lg font-bold text-neutral-900">Pedidos</h1>
        <p className="text-sm text-neutral-500">
          Toque numa venda pra ver os detalhes e baixar a planilha, a etiqueta e a nota fiscal pra mandar no grupo de WhatsApp do seu fornecedor.
        </p>
      </div>

      <PedidosTabs
        tabs={[
          { id: "atrasados", label: "Atrasados", count: atrasados.length, content: <BlocoAEnviar pedidos={atrasados} /> },
          { id: "hoje", label: "Hoje", count: hoje.length, content: <BlocoAEnviar pedidos={hoje} /> },
          { id: "proximos_dias", label: "Próximos dias", count: proximosDias.length, content: <BlocoAEnviar pedidos={proximosDias} /> },
          {
            id: "enviados",
            label: "Enviados",
            count: enviados.length,
            content: (
              <Card>
                <CardBody className="p-0">
                  <ListaPedidos pedidos={enviados} mostrarEnvioML />
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

/** Conteúdo de cada aba de urgência (Atrasados/Hoje/Próximos dias) — separa
 *  os já "pronto" (agrupados por fornecedor, pro pacote combinado) dos que
 *  ainda estão "aguardando_nf" (nada a baixar ainda, só o aviso). */
function BlocoAEnviar({ pedidos }: { pedidos: PedidoDrop[] }) {
  if (pedidos.length === 0) {
    return (
      <Card>
        <CardBody className="text-sm text-neutral-600">Nenhuma venda nessa situação.</CardBody>
      </Card>
    );
  }

  const prontos = pedidos.filter((p) => p.status === "pronto");
  const aguardandoNf = pedidos.filter((p) => p.status === "aguardando_nf");
  const gruposProntos = agruparPorFornecedor(prontos);

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-400">
        Prazo estimado (etiqueta impressa + 24h) — não é o horário exato de corte da agência do Mercado Livre.
      </p>
      {gruposProntos.length > 0 && (
        <Card>
          <CardHeader
            title="Pronto pra enviar ao fornecedor"
            description="Selecione os pedidos de um fornecedor e baixe um único pacote (etiquetas, notas fiscais e planilha) pra mandar de uma vez no grupo de WhatsApp dele."
          />
          <CardBody className="space-y-3">
            {gruposProntos.map((g) => (
              <PedidosFornecedorGroup key={g.fornecedorNome} fornecedorNome={g.fornecedorNome} pedidos={g.pedidos} />
            ))}
          </CardBody>
        </Card>
      )}
      {aguardandoNf.length > 0 && (
        <Card>
          <CardHeader
            title="Aguardando você emitir a NF no Mercado Livre"
            description="A etiqueta só fica pronta pra baixar depois que você declara a nota fiscal do consumidor final lá no Mercado Livre."
          />
          <CardBody className="p-0">
            <ListaPedidos pedidos={aguardandoNf} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function ListaPedidos({ pedidos, mostrarEnvioML = false }: { pedidos: PedidoDrop[]; mostrarEnvioML?: boolean }) {
  if (pedidos.length === 0) {
    return <p className="p-5 text-sm text-neutral-600">Nenhuma venda nessa situação.</p>;
  }
  return (
    <div className="divide-y divide-neutral-100">
      {pedidos.map((p) => {
        const status = STATUS_LABEL[p.status];
        const envioMl = p.mlShippingStatus ? ML_SHIPPING_LABEL[p.mlShippingStatus] : null;
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
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone={status.tone}>{status.label}</Badge>
                {mostrarEnvioML && envioMl && <Badge tone={envioMl.tone}>{envioMl.label}</Badge>}
              </div>
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
        )}
      </CardBody>
    </Card>
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
    };
    const lista = grupos.get(p.fornecedorNome) ?? [];
    lista.push(item);
    grupos.set(p.fornecedorNome, lista);
  }
  return [...grupos.entries()]
    .map(([fornecedorNome, lista]) => ({ fornecedorNome, pedidos: lista.sort((a, b) => a.numero - b.numero) }))
    .sort((a, b) => a.fornecedorNome.localeCompare(b.fornecedorNome));
}
