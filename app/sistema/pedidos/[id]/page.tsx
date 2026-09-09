import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil } from "lucide-react";
import { requireSistemaProfile, canManage } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { profileLabelMap } from "@/lib/sistema/queries";
import { getPedidoDoc, pedidoDocToText } from "@/lib/sistema/pedido-doc";
import { formatBRL, formatPercent, formatDate, formatDateTime } from "@/lib/sistema/format";
import { Card, CardBody, CardHeader } from "@/components/sistema/ui/Card";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import { Badge, PEDIDO_STATUS } from "@/components/sistema/ui/Badge";
import CopiarPedidoButton from "@/components/sistema/pedidos/CopiarPedidoButton";
import GerarPedidoButton from "@/components/sistema/pedidos/GerarPedidoButton";
import EnviarLinkPedido from "@/components/sistema/pedidos/EnviarLinkPedido";
import EnviarPedidoEmail from "@/components/sistema/pedidos/EnviarPedidoEmail";
import PedidoDropActions from "@/components/sistema/estoque/PedidoDropActions";
import { canFinance } from "@/lib/sistema/roles";
import {
  TableScroll,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@/components/sistema/ui/Table";
import PedidoActions from "@/components/sistema/pedidos/PedidoActions";
import PedidoStatusControl from "@/components/sistema/pedidos/PedidoStatusControl";
import type { Pedido } from "@/lib/sistema/types";

export default async function PedidoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireSistemaProfile();
  const { id } = await params;
  const supabase = await createSistemaClient();

  const { data } = await supabase
    .from("pedidos")
    .select(
      "*, cliente:clientes(id, nome_fantasia, razao_social, cnpj, cpf, cidade, estado, email), representada:representadas(id, nome_fantasia, razao_social), tabela:tabelas_preco(nome)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const p = data as unknown as Pedido & {
    enviado_email_at: string | null;
    cliente: {
      id: string;
      nome_fantasia: string | null;
      razao_social: string | null;
      cnpj: string | null;
      cpf: string | null;
      cidade: string | null;
      estado: string | null;
      email: string | null;
    } | null;
    representada: { id: string; nome_fantasia: string | null; razao_social: string } | null;
    tabela: { nome: string } | null;
  };

  const [{ data: historico }, profileMap, doc] = await Promise.all([
    supabase
      .from("pedido_historico")
      .select("*")
      .eq("pedido_id", id)
      .order("created_at", { ascending: false }),
    profileLabelMap(),
    getPedidoDoc(id),
  ]);

  const pd = p as unknown as {
    tipo?: string;
    canal?: string | null;
    pedido_externo?: string | null;
    entrega_nome?: string | null;
    entrega_documento?: string | null;
    entrega_telefone?: string | null;
    entrega_logradouro?: string | null;
    entrega_numero?: string | null;
    entrega_complemento?: string | null;
    entrega_bairro?: string | null;
    entrega_cidade?: string | null;
    entrega_uf?: string | null;
    entrega_cep?: string | null;
  };
  const isDrop = pd.tipo === "drop_proprio";

  const st = PEDIDO_STATUS[p.status] ?? { label: p.status, tone: "neutral" as const };
  const podeEditarStatus = profile.role !== "consulta";
  const terminal = ["faturado", "em_transporte", "entregue", "cancelado", "rejeitado"].includes(
    p.status
  );
  const editavel = profile.role !== "consulta" && !terminal;
  const podeGerar =
    profile.role !== "consulta" &&
    ["orcamento", "aguardando_aprovacao"].includes(p.status);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Pedido #{p.numero}
            </h1>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">
            {p.cliente && (
              <Link href={`/sistema/clientes/${p.cliente.id}`} className="text-brand hover:underline">
                {p.cliente.nome_fantasia || p.cliente.razao_social}
              </Link>
            )}
            {" · "}
            {p.representada && (
              <Link
                href={`/sistema/representadas/${p.representada.id}`}
                className="text-brand hover:underline"
              >
                {p.representada.nome_fantasia || p.representada.razao_social}
              </Link>
            )}
            {" · "}
            {formatDate(p.data_pedido)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDrop && (
            <PedidoDropActions id={p.id} status={p.status} podeFaturar={canFinance(profile.role)} />
          )}
          {!isDrop && podeGerar && <GerarPedidoButton id={p.id} />}
          {editavel && (
            <Link
              href={`/sistema/pedidos/${p.id}/editar`}
              className={buttonClass({ variant: "outline", size: "sm" })}
            >
              <Pencil size={14} /> Editar
            </Link>
          )}
          <a
            href={`/api/sistema/pedidos/${p.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ variant: "outline", size: "sm" })}
          >
            <FileText size={14} /> Baixar PDF
          </a>
          {doc && <CopiarPedidoButton texto={pedidoDocToText(doc)} />}
          {profile.role !== "consulta" && (
            <EnviarPedidoEmail
              pedidoId={p.id}
              numero={p.numero}
              clienteEmail={p.cliente?.email}
              jaEnviado={!!p.enviado_email_at}
            />
          )}
          <PedidoActions id={p.id} status={p.status} canManage={canManage(profile.role)} />
        </div>
      </div>

      {isDrop && (
        <Card className="mb-4">
          <CardHeader
            title="Entrega ao consumidor (drop)"
            description={[pd.canal, pd.pedido_externo && `Pedido ${pd.pedido_externo}`].filter(Boolean).join(" · ") || undefined}
          />
          <CardBody className="text-sm text-neutral-700">
            <div className="font-semibold text-neutral-900">{pd.entrega_nome || "—"}</div>
            {pd.entrega_documento && <div className="text-xs text-neutral-500">{pd.entrega_documento}</div>}
            <div>
              {[pd.entrega_logradouro, pd.entrega_numero, pd.entrega_complemento].filter(Boolean).join(", ")}
            </div>
            <div>
              {[pd.entrega_bairro, [pd.entrega_cidade, pd.entrega_uf].filter(Boolean).join("/"), pd.entrega_cep]
                .filter(Boolean)
                .join(" — ")}
            </div>
            {pd.entrega_telefone && <div className="text-xs text-neutral-500">Tel: {pd.entrega_telefone}</div>}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Info + Cliente */}
        <div className="space-y-4 lg:col-span-1">
          {!isDrop && (
            <Card>
              <CardHeader title="Link do pedido" description="Envie ao cliente sem precisar de login." />
              <CardBody>
                <EnviarLinkPedido
                  token={p.share_token}
                  numero={p.numero}
                  whatsapp={doc?.cliente.telefone ?? null}
                />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Cliente" />
            <CardBody className="text-sm">
              {doc && (
                <>
                  <div className="mb-1 font-semibold text-neutral-900">{doc.cliente.nome}</div>
                  {doc.cliente.razao && (
                    <div className="text-xs text-neutral-500">{doc.cliente.razao}</div>
                  )}
                  <div className="mt-2 space-y-0.5 text-xs text-neutral-600">
                    {doc.cliente.documento && <div>CNPJ/CPF: {doc.cliente.documento}</div>}
                    {doc.cliente.inscricaoEstadual && <div>IE: {doc.cliente.inscricaoEstadual}</div>}
                    {doc.cliente.endereco && <div>{doc.cliente.endereco}</div>}
                    {(doc.cliente.bairro || doc.cliente.cidadeUf || doc.cliente.cep) && (
                      <div>
                        {[doc.cliente.bairro, doc.cliente.cidadeUf, doc.cliente.cep && `CEP ${doc.cliente.cep}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                    {doc.cliente.telefone && <div>Tel: {doc.cliente.telefone}</div>}
                    {doc.cliente.email && <div>{doc.cliente.email}</div>}
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Informações" />
            <CardBody className="text-sm">
              <Row label="Tabela" value={p.tabela?.nome} />
              <Row label="Vendedor" value={p.vendedor_id ? profileMap.get(p.vendedor_id) : ""} />
              <Row label="Pagamento" value={p.condicao_pagamento} />
              <Row label="Forma" value={p.forma_pagamento} />
              <Row label="Previsão entrega" value={p.previsao_entrega ? formatDate(p.previsao_entrega) : ""} />
              <Row label="Nº fábrica" value={p.numero_pedido_fabrica} />
              {podeEditarStatus && (
                <div className="pt-3">
                  <p className="mb-1 text-xs font-semibold text-neutral-500">Alterar status</p>
                  <PedidoStatusControl id={p.id} status={p.status} />
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Itens + totais */}
        <Card className="lg:col-span-2">
          <CardHeader title="Itens" />
          <CardBody className="p-0">
            <TableScroll>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Código</Th>
                    <Th>Produto</Th>
                    <Th className="text-right">Qtd</Th>
                    <Th className="text-right">Preço</Th>
                    <Th className="text-right">Desc.</Th>
                    <Th className="text-right">Total</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {(doc?.itens ?? []).map((it, i) => (
                    <Tr key={i}>
                      <Td className="font-mono text-xs">{it.sku}</Td>
                      <Td>{it.descricao}</Td>
                      <Td className="text-right">{it.qtd}</Td>
                      <Td className="text-right">{formatBRL(it.preco)}</Td>
                      <Td className="text-right">
                        {it.descPct > 0 ? formatPercent(it.descPct) : "—"}
                      </Td>
                      <Td className="text-right font-medium">{formatBRL(it.total)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableScroll>
            <div className="border-t border-neutral-200 p-4">
              <div className="ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Subtotal</span>
                  <span>{formatBRL(Number(p.subtotal))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    Desconto adicional ({formatPercent(Number(p.desconto_percentual))})
                  </span>
                  <span className="text-red-600">− {formatBRL(Number(p.desconto_valor))}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-200 pt-1 text-base font-bold">
                  <span>Total</span>
                  <span>{formatBRL(Number(p.valor_total))}</span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {(p.observacao_cliente || p.observacao_interna || p.observacao_representada) && (
        <Card className="mt-4">
          <CardHeader title="Observações" />
          <CardBody className="space-y-2 text-sm">
            {p.observacao_cliente && (
              <p>
                <span className="text-neutral-500">Cliente: </span>
                {p.observacao_cliente}
              </p>
            )}
            {p.observacao_representada && (
              <p>
                <span className="text-neutral-500">Representada: </span>
                {p.observacao_representada}
              </p>
            )}
            {p.observacao_interna && (
              <p>
                <span className="text-neutral-500">Interna: </span>
                {p.observacao_interna}
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader title="Histórico" />
        <CardBody>
          <ol className="space-y-3">
            {(historico ?? []).map((h) => {
              const hs = PEDIDO_STATUS[h.status_novo as string];
              return (
                <li key={h.id as string} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <div>
                    <span className="font-medium text-neutral-800">
                      {hs?.label ?? (h.status_novo as string)}
                    </span>
                    {h.descricao && <span className="text-neutral-500"> — {h.descricao as string}</span>}
                    <div className="text-xs text-neutral-400">
                      {formatDateTime(h.created_at as string)}
                      {h.usuario_id ? ` · ${profileMap.get(h.usuario_id as string) ?? ""}` : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-2 last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-800">{value || "—"}</span>
    </div>
  );
}
