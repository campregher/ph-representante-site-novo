"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { parseNumeroBR, formatBRL } from "@/lib/sistema/format";
import { precoLiquido } from "@/lib/sistema/preco";
import { upsertPrecos } from "@/lib/sistema/actions/tabelas";
import { Button } from "@/components/sistema/ui/Button";
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

export interface PrecoRow {
  produto_id: string;
  sku: string;
  nome: string;
  preco_bruto: number | null;
  override: number | null;
}

function toStr(n: number | null): string {
  return n == null ? "" : String(n).replace(".", ",");
}

export default function PrecoGrid({
  tabelaId,
  descontoTabela,
  rows,
  canManage,
}: {
  tabelaId: string;
  descontoTabela: number;
  rows: PrecoRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [filter, setFilter] = useState("");

  const [over, setOver] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const r of rows) m[r.produto_id] = toStr(r.override);
    return m;
  });

  const dirty = useMemo(
    () => rows.some((r) => (over[r.produto_id] ?? "") !== toStr(r.override)),
    [over, rows]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.sku.toLowerCase().includes(q) || r.nome.toLowerCase().includes(q)
    );
  }, [rows, filter]);

  function save() {
    const payload = rows.map((r) => ({
      produto_id: r.produto_id,
      preco: parseNumeroBR(over[r.produto_id] ?? ""),
      preco_minimo: null,
      desconto_maximo: null,
    }));
    startSave(async () => {
      const res = await upsertPrecos(tabelaId, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Overrides salvos (${res.salvos ?? 0}) · removidos (${res.removidos ?? 0}).`);
      router.refresh();
    });
  }

  const semBruto = rows.filter((r) => r.preco_bruto == null).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar produto por SKU ou nome…"
            className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
          />
        </div>
        <span className="text-xs text-neutral-500">
          Desconto da tabela: <b>{descontoTabela}%</b>
          {semBruto > 0 && ` · ${semBruto} sem preço bruto`}
        </span>
        {canManage && (
          <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
            Salvar overrides
          </Button>
        )}
      </div>

      <TableScroll>
        <Table>
          <Thead>
            <Tr>
              <Th>SKU</Th>
              <Th>Produto</Th>
              <Th className="text-right">Preço bruto</Th>
              <Th className="text-right">Líquido (calc.)</Th>
              <Th className="text-right">Override (R$)</Th>
              <Th className="text-right">Preço final</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={6}>
                Esta representada não tem produtos. Cadastre ou importe produtos primeiro.
              </TableEmpty>
            ) : filtered.length === 0 ? (
              <TableEmpty colSpan={6}>Nenhum produto para “{filter}”.</TableEmpty>
            ) : (
              filtered.map((r) => {
                const calc = precoLiquido(r.preco_bruto, descontoTabela, null);
                const ovNum = parseNumeroBR(over[r.produto_id] ?? "");
                const final = precoLiquido(r.preco_bruto, descontoTabela, ovNum);
                return (
                  <Tr key={r.produto_id}>
                    <Td className="font-mono text-xs">{r.sku}</Td>
                    <Td>{r.nome}</Td>
                    <Td className="text-right">{r.preco_bruto != null ? formatBRL(r.preco_bruto) : "—"}</Td>
                    <Td className="text-right text-neutral-500">{calc != null ? formatBRL(calc) : "—"}</Td>
                    <Td className="text-right">
                      <input
                        value={over[r.produto_id] ?? ""}
                        onChange={(e) => setOver((o) => ({ ...o, [r.produto_id]: e.target.value }))}
                        disabled={!canManage}
                        inputMode="decimal"
                        placeholder="—"
                        className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 text-right text-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10 disabled:bg-neutral-100"
                      />
                    </Td>
                    <Td className="text-right font-medium">{final != null ? formatBRL(final) : "—"}</Td>
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </TableScroll>

      {dirty && (
        <p className="mt-2 text-xs text-amber-600">
          Overrides não salvos. Deixar em branco = usar o preço calculado (bruto − desconto).
        </p>
      )}
    </div>
  );
}
