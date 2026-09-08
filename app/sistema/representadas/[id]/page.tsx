import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Building2, Package, Tags, Printer } from "lucide-react";
import { requireSistemaProfile, canManage } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { getRepresentada } from "@/lib/sistema/queries";
import {
  formatCNPJ,
  formatPhone,
  formatPercent,
  formatBRL,
  formatDate,
} from "@/lib/sistema/format";
import { Card, CardBody, CardHeader } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";
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
import RepresentadaActions from "@/components/sistema/representadas/RepresentadaActions";

const TABS = [
  { key: "geral", label: "Visão Geral" },
  { key: "produtos", label: "Produtos" },
  { key: "tabelas", label: "Tabelas" },
  { key: "clientes", label: "Clientes" },
  { key: "pedidos", label: "Pedidos" },
  { key: "comissoes", label: "Comissões" },
];

export default async function RepresentadaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireSistemaProfile();
  const { id } = await params;
  const { tab = "geral" } = await searchParams;
  const r = await getRepresentada(id);
  if (!r) notFound();

  const supabase = await createSistemaClient();
  const [{ count: nProdutos }, { count: nTabelas }] = await Promise.all([
    supabase.from("produtos").select("id", { count: "exact", head: true }).eq("representada_id", id),
    supabase.from("tabelas_preco").select("id", { count: "exact", head: true }).eq("representada_id", id),
  ]);

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {r.logo_url ? (
              <Image src={r.logo_url} alt="" width={56} height={56} className="h-full w-full object-contain p-1" unoptimized />
            ) : (
              <Building2 size={22} className="text-neutral-300" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                {r.nome_fantasia || r.razao_social}
              </h1>
              <Badge tone={r.ativa ? "green" : "neutral"}>{r.ativa ? "Ativa" : "Inativa"}</Badge>
              {r.modalidades?.includes("atacado") && <Badge tone="blue">Atacado</Badge>}
              {r.modalidades?.includes("dropshipping") && <Badge tone="purple">Dropshipping</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">
              {r.razao_social}
              {r.cnpj ? ` · ${formatCNPJ(r.cnpj)}` : ""}
            </p>
            <div className="mt-2 flex gap-2 text-xs text-neutral-500">
              <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1">
                <Package size={12} /> {nProdutos ?? 0} produtos
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1">
                <Tags size={12} /> {nTabelas ?? 0} tabelas
              </span>
            </div>
          </div>
        </div>
        <RepresentadaActions id={r.id} ativa={r.ativa} canManage={canManage(profile.role)} />
      </div>

      {/* Abas */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Link
              key={t.key}
              href={`/sistema/representadas/${id}?tab=${t.key}`}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {tab === "geral" && <GeralTab r={r} />}
      {tab === "produtos" && <ProdutosTab id={id} />}
      {tab === "tabelas" && <TabelasTab id={id} />}
      {["clientes", "pedidos", "comissoes"].includes(tab) && (
        <ComingSoon title={TABS.find((t) => t.key === tab)?.label ?? "Seção"} phase="uma próxima fase" />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-800">{value || "—"}</span>
    </div>
  );
}

function GeralTab({ r }: { r: Awaited<ReturnType<typeof getRepresentada>> }) {
  if (!r) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Contato" />
        <CardBody>
          <Row label="Telefone" value={r.telefone ? formatPhone(r.telefone) : ""} />
          <Row label="WhatsApp" value={r.whatsapp ? formatPhone(r.whatsapp) : ""} />
          <Row label="E-mail" value={r.email} />
          <Row label="Site" value={r.site} />
          <Row label="Contato comercial" value={r.contato_comercial} />
          <Row label="Contato financeiro" value={r.contato_financeiro} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Condições comerciais padrão" />
        <CardBody>
          <Row label="Pedido mínimo" value={r.pedido_minimo ? formatBRL(r.pedido_minimo) : ""} />
          <Row
            label="Comissão padrão"
            value={r.percentual_comissao_padrao ? formatPercent(r.percentual_comissao_padrao) : ""}
          />
          <Row
            label="Desconto máximo padrão"
            value={r.desconto_maximo_padrao ? formatPercent(r.desconto_maximo_padrao) : ""}
          />
          <Row label="Prazo de pagamento" value={r.prazo_pagamento_padrao} />
          <Row label="Prazo de entrega" value={r.prazo_entrega} />
          <Row label="Cadastrada em" value={formatDate(r.created_at)} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Endereço" />
        <CardBody>
          <Row
            label="Logradouro"
            value={[r.logradouro, r.numero].filter(Boolean).join(", ")}
          />
          <Row label="Complemento" value={r.complemento} />
          <Row label="Bairro" value={r.bairro} />
          <Row
            label="Cidade / UF"
            value={[r.cidade, r.estado].filter(Boolean).join(" / ")}
          />
          <Row label="CEP" value={r.cep} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Modalidades" />
        <CardBody>
          <Row
            label="Atende"
            value={
              r.modalidades?.length
                ? r.modalidades
                    .map((m) => (m === "atacado" ? "Atacado" : m === "dropshipping" ? "Dropshipping" : m))
                    .join(" · ")
                : ""
            }
          />
          {r.modalidades?.includes("dropshipping") && (
            <>
              <Row label="Faturamento dropship" value={r.dropship_faturamento} />
              <Row
                label="Pagamento dropship"
                value={r.dropship_condicoes_pagamento?.join(" · ")}
              />
              {r.dropship_observacoes && (
                <div className="pt-2 text-sm">
                  <span className="text-neutral-500">Observações do dropship</span>
                  <p className="mt-1 whitespace-pre-wrap text-neutral-700">
                    {r.dropship_observacoes}
                  </p>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
      {r.observacoes && (
        <Card className="lg:col-span-2">
          <CardHeader title="Observações" />
          <CardBody>
            <p className="whitespace-pre-wrap text-sm text-neutral-700">{r.observacoes}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

async function ProdutosTab({ id }: { id: string }) {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("produtos")
    .select("id, sku, nome, marca, ativo")
    .eq("representada_id", id)
    .order("nome", { ascending: true })
    .limit(50);
  const rows = data ?? [];

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Link
          href={`/sistema/produtos?representada=${id}`}
          className="text-sm font-medium text-brand hover:underline"
        >
          Ver todos em Produtos →
        </Link>
      </div>
      <TableScroll>
        <Table>
          <Thead>
            <Tr>
              <Th>SKU</Th>
              <Th>Produto</Th>
              <Th>Marca</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={4}>Nenhum produto desta representada.</TableEmpty>
            ) : (
              rows.map((p) => (
                <Tr key={p.id as string}>
                  <Td className="font-mono text-xs">{p.sku as string}</Td>
                  <Td>
                    <Link href={`/sistema/produtos/${p.id}`} className="text-neutral-900 hover:text-brand">
                      {p.nome as string}
                    </Link>
                  </Td>
                  <Td>{(p.marca as string) || "—"}</Td>
                  <Td>
                    <Badge tone={p.ativo ? "green" : "neutral"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </TableScroll>
      {rows.length === 50 && (
        <p className="mt-2 text-xs text-neutral-400">Mostrando os primeiros 50.</p>
      )}
    </div>
  );
}

async function TabelasTab({ id }: { id: string }) {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("tabelas_preco")
    .select("id, nome, tipo, data_inicio, data_fim, ativa")
    .eq("representada_id", id)
    .order("nome", { ascending: true });
  const rows = data ?? [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-4">
        <Link
          href={`/imprimir/representada/${id}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <Printer size={14} /> Imprimir tabela de preços
        </Link>
        <Link
          href={`/sistema/tabelas?representada=${id}`}
          className="text-sm font-medium text-brand hover:underline"
        >
          Ver em Tabelas de Preço →
        </Link>
      </div>
      <TableScroll>
        <Table>
          <Thead>
            <Tr>
              <Th>Tabela</Th>
              <Th>Tipo</Th>
              <Th>Vigência</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={4}>Nenhuma tabela de preço.</TableEmpty>
            ) : (
              rows.map((t) => (
                <Tr key={t.id as string}>
                  <Td>
                    <Link href={`/sistema/tabelas/${t.id}`} className="text-neutral-900 hover:text-brand">
                      {t.nome as string}
                    </Link>
                  </Td>
                  <Td>{(t.tipo as string) || "—"}</Td>
                  <Td className="text-xs">
                    {t.data_inicio ? formatDate(t.data_inicio as string) : "—"}
                    {" – "}
                    {t.data_fim ? formatDate(t.data_fim as string) : "sem fim"}
                  </Td>
                  <Td>
                    <Badge tone={t.ativa ? "green" : "neutral"}>{t.ativa ? "Ativa" : "Inativa"}</Badge>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </TableScroll>
    </div>
  );
}
