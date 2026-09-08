import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, MessageCircle, Mail } from "lucide-react";
import { requireSistemaProfile, canManage } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import {
  listRepresentadaOptions,
  listAllTabelas,
  representadaLabelMap,
  profileLabelMap,
} from "@/lib/sistema/queries";
import {
  formatBRL,
  formatCpfCnpj,
  formatPhone,
  formatDate,
  daysSince,
} from "@/lib/sistema/format";
import { STATUS_VENDA } from "@/lib/sistema/types";
import { Card, CardBody, CardHeader, StatCard } from "@/components/sistema/ui/Card";
import { Badge, CLIENTE_STATUS, PEDIDO_STATUS } from "@/components/sistema/ui/Badge";
import { ComingSoon } from "@/components/sistema/ui/State";
import {
  TableScroll,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableEmpty,
} from "@/components/sistema/ui/Table";
import ClienteActions from "@/components/sistema/clientes/ClienteActions";
import ContatosManager from "@/components/sistema/clientes/ContatosManager";
import VinculosManager, {
  type VinculoRow,
} from "@/components/sistema/clientes/VinculosManager";
import type { Cliente, ClienteContato } from "@/lib/sistema/types";

const TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "pedidos", label: "Pedidos" },
  { key: "representadas", label: "Representadas" },
  { key: "contatos", label: "Contatos" },
  { key: "oportunidades", label: "Oportunidades" },
];

export default async function ClienteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireSistemaProfile();
  const { id } = await params;
  const { tab = "resumo" } = await searchParams;
  const supabase = await createSistemaClient();

  const { data } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Cliente;

  const [profileMap, repMap] = await Promise.all([profileLabelMap(), representadaLabelMap()]);

  const { data: pedidosRaw } = await supabase
    .from("pedidos")
    .select("id, numero, data_pedido, status, valor_total, representada_id")
    .eq("cliente_id", id)
    .order("data_pedido", { ascending: false });
  const pedidos = pedidosRaw ?? [];

  const vendas = pedidos.filter((p) => (STATUS_VENDA as readonly string[]).includes(p.status as string));
  const totalVendas = vendas.reduce((s, p) => s + Number(p.valor_total ?? 0), 0);
  const anoAtual = new Date().getFullYear();
  const vendasAno = vendas
    .filter((p) => new Date(p.data_pedido as string).getFullYear() === anoAtual)
    .reduce((s, p) => s + Number(p.valor_total ?? 0), 0);
  const ticket = vendas.length ? totalVendas / vendas.length : 0;
  const ultimaCompra =
    c.data_ultima_compra ??
    (vendas[0]?.data_pedido ? String(vendas[0].data_pedido).slice(0, 10) : null);

  const porRepresentada = new Map<string, number>();
  for (const p of vendas) {
    const k = p.representada_id as string;
    porRepresentada.set(k, (porRepresentada.get(k) ?? 0) + Number(p.valor_total ?? 0));
  }

  return (
    <div>
      {/* Cabeçalho 360º */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Users size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                {c.nome_fantasia || c.razao_social}
              </h1>
              <Badge tone={(CLIENTE_STATUS[c.status]?.tone ?? "neutral")}>
                {CLIENTE_STATUS[c.status]?.label ?? c.status}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">
              {c.razao_social && c.nome_fantasia ? `${c.razao_social} · ` : ""}
              {formatCpfCnpj(c.cnpj || c.cpf) || "sem documento"}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500">
              {(c.whatsapp || c.telefone) && (
                <span className="inline-flex items-center gap-1">
                  <MessageCircle size={12} /> {formatPhone(c.whatsapp || c.telefone || "")}
                </span>
              )}
              {c.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail size={12} /> {c.email}
                </span>
              )}
              <span>
                Vendedor: {c.vendedor_id ? profileMap.get(c.vendedor_id) ?? "—" : "—"}
              </span>
            </div>
          </div>
        </div>
        <ClienteActions id={c.id} canDelete={canManage(profile.role)} />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Vendas acumuladas" value={formatBRL(totalVendas)} />
        <StatCard label={`Vendas ${anoAtual}`} value={formatBRL(vendasAno)} />
        <StatCard label="Ticket médio" value={formatBRL(ticket)} />
        <StatCard label="Pedidos" value={String(pedidos.length)} />
        <StatCard
          label="Última compra"
          value={ultimaCompra ? formatDate(ultimaCompra) : "—"}
          hint={
            ultimaCompra
              ? `${daysSince(ultimaCompra)} dia(s) atrás`
              : "sem compras"
          }
        />
      </div>

      {/* Abas */}
      <div className="mb-5 mt-5 flex gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/sistema/clientes/${id}?tab=${t.key}`}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "resumo" && <ResumoTab c={c} profileMap={profileMap} />}

      {tab === "pedidos" && (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>Pedido</Th>
                <Th>Data</Th>
                <Th>Representada</Th>
                <Th>Status</Th>
                <Th className="text-right">Valor</Th>
              </Tr>
            </Thead>
            <Tbody>
              {pedidos.length === 0 ? (
                <TableEmpty colSpan={5}>Nenhum pedido para este cliente.</TableEmpty>
              ) : (
                pedidos.map((p) => {
                  const st = PEDIDO_STATUS[p.status as string] ?? {
                    label: p.status as string,
                    tone: "neutral" as const,
                  };
                  return (
                    <Tr key={p.id as string}>
                      <Td>
                        <Link
                          href={`/sistema/pedidos/${p.id}`}
                          className="font-medium text-neutral-900 hover:text-brand"
                        >
                          #{p.numero as number}
                        </Link>
                      </Td>
                      <Td className="text-xs">{formatDate(p.data_pedido as string)}</Td>
                      <Td>{repMap.get(p.representada_id as string) ?? "—"}</Td>
                      <Td>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </Td>
                      <Td className="text-right font-medium">{formatBRL(Number(p.valor_total))}</Td>
                    </Tr>
                  );
                })
              )}
            </Tbody>
          </Table>
        </TableScroll>
      )}

      {tab === "representadas" && (
        <RepresentadasTab
          clienteId={id}
          readOnly={profile.role === "consulta"}
          porRepresentada={porRepresentada}
          repMap={repMap}
        />
      )}

      {tab === "contatos" && (
        <ContatosTab clienteId={id} readOnly={profile.role === "consulta"} />
      )}

      {tab === "oportunidades" && (
        <ComingSoon
          title="Oportunidades do cliente"
          phase="Fase 3 (regras: nunca comprou X, parou de comprar Y, queda de compras…)"
        />
      )}
    </div>
  );
}

function DefRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-800">{value || "—"}</span>
    </div>
  );
}

function ResumoTab({
  c,
  profileMap,
}: {
  c: Cliente;
  profileMap: Map<string, string>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Dados" />
        <CardBody>
          <DefRow label="Tipo" value={c.tipo_pessoa === "fisica" ? "Pessoa física" : "Pessoa jurídica"} />
          <DefRow label="Documento" value={formatCpfCnpj(c.cnpj || c.cpf)} />
          <DefRow label="Inscrição estadual" value={c.inscricao_estadual} />
          <DefRow label="Razão social" value={c.razao_social} />
          <DefRow label="Nome fantasia" value={c.nome_fantasia} />
          <DefRow label="Vendedor" value={c.vendedor_id ? profileMap.get(c.vendedor_id) : ""} />
          <DefRow
            label="Limite de crédito"
            value={c.limite_credito ? formatBRL(c.limite_credito) : ""}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Contato e endereço" />
        <CardBody>
          <DefRow label="Telefone" value={c.telefone ? formatPhone(c.telefone) : ""} />
          <DefRow label="WhatsApp" value={c.whatsapp ? formatPhone(c.whatsapp) : ""} />
          <DefRow label="E-mail" value={c.email} />
          <DefRow label="Site" value={c.site} />
          <DefRow
            label="Endereço"
            value={[c.logradouro, c.numero, c.bairro].filter(Boolean).join(", ")}
          />
          <DefRow label="Cidade / UF" value={[c.cidade, c.estado].filter(Boolean).join(" / ")} />
          <DefRow label="CEP" value={c.cep} />
        </CardBody>
      </Card>
      {c.observacoes && (
        <Card className="lg:col-span-2">
          <CardHeader title="Observações" />
          <CardBody>
            <p className="whitespace-pre-wrap text-sm text-neutral-700">{c.observacoes}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

async function ContatosTab({ clienteId, readOnly }: { clienteId: string; readOnly: boolean }) {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("cliente_contatos")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("principal", { ascending: false })
    .order("nome", { ascending: true });
  return (
    <ContatosManager
      clienteId={clienteId}
      contatos={(data as ClienteContato[]) ?? []}
      readOnly={readOnly}
    />
  );
}

async function RepresentadasTab({
  clienteId,
  readOnly,
  porRepresentada,
  repMap,
}: {
  clienteId: string;
  readOnly: boolean;
  porRepresentada: Map<string, number>;
  repMap: Map<string, string>;
}) {
  const supabase = await createSistemaClient();
  const [{ data: vincs }, repOptions, tabelas] = await Promise.all([
    supabase
      .from("cliente_representada")
      .select(
        "*, representada:representadas(nome_fantasia, razao_social), tabela:tabelas_preco(nome)"
      )
      .eq("cliente_id", clienteId),
    listRepresentadaOptions(),
    listAllTabelas(),
  ]);

  const rows: VinculoRow[] = (vincs ?? []).map((v) => {
    const rep = v.representada as unknown as {
      nome_fantasia: string | null;
      razao_social: string;
    } | null;
    const tab = v.tabela as unknown as { nome: string } | null;
    return {
      id: v.id as string,
      representada_id: v.representada_id as string,
      representada_label: rep ? rep.nome_fantasia || rep.razao_social : "—",
      tabela_preco_id: (v.tabela_preco_id as string) ?? null,
      tabela_label: tab?.nome ?? null,
      condicao_pagamento: (v.condicao_pagamento as string) ?? null,
      desconto_padrao: v.desconto_padrao != null ? Number(v.desconto_padrao) : null,
      limite_credito: v.limite_credito != null ? Number(v.limite_credito) : null,
      observacoes: (v.observacoes as string) ?? null,
    };
  });

  const compras = [...porRepresentada.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      {compras.length > 0 && (
        <Card>
          <CardHeader title="Quanto compra em cada representada" />
          <CardBody className="space-y-1.5">
            {compras.map(([repId, valor]) => (
              <div key={repId} className="flex justify-between text-sm">
                <span className="text-neutral-600">{repMap.get(repId) ?? "—"}</span>
                <span className="font-medium text-neutral-900">{formatBRL(valor)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
      <VinculosManager
        clienteId={clienteId}
        vinculos={rows}
        representadaOptions={repOptions}
        tabelas={tabelas.map((t) => ({ id: t.id, nome: t.nome, representada_id: t.representada_id }))}
        readOnly={readOnly}
      />
    </div>
  );
}
