import Link from "next/link";
import { Plus, Boxes, Truck, ClipboardList, ArrowLeftRight, AlertTriangle, Coins, Package } from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { listProdutosProprios, estoqueKpis } from "@/lib/sistema/estoque";
import { formatBRL, formatNumber } from "@/lib/sistema/format";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { StatCard } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import Filters from "@/components/sistema/Filters";
import AjusteEstoqueButton from "@/components/sistema/estoque/AjusteEstoqueButton";
import { TableScroll, Table, Thead, Tbody, Tr, Th, Td, TableEmpty } from "@/components/sistema/ui/Table";

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSistemaProfile();
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim();
  const baixo = sp.baixo === "1";

  const [kpis, rows] = await Promise.all([
    estoqueKpis(),
    listProdutosProprios({ busca, baixoEstoque: baixo }),
  ]);

  const nav = [
    { href: "/sistema/estoque/produtos/nova", label: "Novo produto", icon: <Plus size={15} /> },
    { href: "/sistema/estoque/compras/nova", label: "Nova compra", icon: <ClipboardList size={15} /> },
    { href: "/sistema/estoque/vendas/nova", label: "Novo pedido drop", icon: <Package size={15} /> },
    { href: "/sistema/estoque/fornecedores", label: "Fornecedores", icon: <Truck size={15} /> },
    { href: "/sistema/estoque/compras", label: "Compras", icon: <ClipboardList size={15} /> },
    { href: "/sistema/estoque/movimentos", label: "Movimentos", icon: <ArrowLeftRight size={15} /> },
  ];

  return (
    <div>
      <PageHeader title="Linha Própria" description="Estoque físico e venda no dropshipping." />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="SKUs próprios" value={String(kpis.skus)} icon={<Boxes size={16} />} />
        <StatCard label="Unidades em estoque" value={formatNumber(kpis.unidades, 0)} icon={<Package size={16} />} />
        <StatCard label="Valor em estoque (custo)" value={formatBRL(kpis.valorCusto)} icon={<Coins size={16} />} />
        <StatCard
          label="Abaixo do mínimo"
          value={String(kpis.baixoEstoque)}
          icon={<AlertTriangle size={16} />}
          hint={kpis.baixoEstoque > 0 ? "repor" : undefined}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={buttonClass({ variant: "outline", size: "sm" })}>
            {n.icon} {n.label}
          </Link>
        ))}
      </div>

      <Filters
        searchPlaceholder="Buscar produto próprio (SKU, nome, EAN)…"
        selects={[{ key: "baixo", label: "Estoque", options: [{ value: "1", label: "Abaixo do mínimo" }] }]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Boxes size={32} />}
          title="Nenhum produto próprio"
          description="Cadastre um produto e registre uma compra para dar entrada no estoque."
          action={
            <Link href="/sistema/estoque/produtos/nova" className={buttonClass({ size: "sm" })}>
              <Plus size={15} /> Novo produto
            </Link>
          }
        />
      ) : (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>SKU</Th>
                <Th>Produto</Th>
                <Th>Fornecedor</Th>
                <Th className="text-right">Custo</Th>
                <Th className="text-right">Venda</Th>
                <Th className="text-right">Estoque</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.length === 0 ? (
                <TableEmpty colSpan={8}>Nada aqui.</TableEmpty>
              ) : (
                rows.map((p) => {
                  const abaixo = p.estoque_atual <= p.estoque_minimo;
                  return (
                    <Tr key={p.id}>
                      <Td className="font-mono text-xs">{p.sku}</Td>
                      <Td>
                        <Link href={`/sistema/estoque/produtos/${p.id}/editar`} className="font-medium text-neutral-900 hover:text-brand">
                          {p.nome}
                        </Link>
                      </Td>
                      <Td>{p.fornecedor ?? "—"}</Td>
                      <Td className="text-right">{p.custo != null ? formatBRL(p.custo) : "—"}</Td>
                      <Td className="text-right">{p.preco_bruto != null ? formatBRL(p.preco_bruto) : "—"}</Td>
                      <Td className="text-right">
                        <span className={abaixo ? "font-semibold text-red-600" : ""}>{p.estoque_atual}</span>
                        {p.estoque_minimo > 0 && <span className="text-neutral-400"> / {p.estoque_minimo}</span>}
                      </Td>
                      <Td>
                        <Badge tone={!p.ativo ? "neutral" : abaixo ? "red" : "green"}>
                          {!p.ativo ? "Inativo" : abaixo ? "Repor" : "OK"}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <AjusteEstoqueButton produtoId={p.id} nome={p.nome} saldoAtual={p.estoque_atual} />
                      </Td>
                    </Tr>
                  );
                })
              )}
            </Tbody>
          </Table>
        </TableScroll>
      )}
    </div>
  );
}
