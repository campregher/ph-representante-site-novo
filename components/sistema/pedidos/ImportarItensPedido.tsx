"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { Modal } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { formatBRL } from "@/lib/sistema/format";

export interface ResolvedRef {
  produto_id: string;
  variacao_id: string | null;
  sku: string;
  nome: string;
  preco: number | null;
  ambiguo?: boolean;
}

export interface ItemImportado {
  produto_id: string;
  variacao_id: string | null;
  sku: string;
  nome: string;
  preco: number;
  quantidade: number;
}

interface Linha {
  sku: string;
  quantidade: number;
  status: "ok" | "somar" | "ambiguo" | "nao_encontrado";
  ref?: ResolvedRef;
}

function parseTexto(txt: string): { sku: string; quantidade: number }[] {
  const out: { sku: string; quantidade: number }[] = [];
  for (const linhaRaw of txt.split(/\r?\n/)) {
    const linha = linhaRaw.trim();
    if (!linha) continue;
    const parts = linha.split(/[\t,;]+|\s{2,}|\s+/).filter(Boolean);
    if (!parts.length) continue;
    const sku = parts[0].trim();
    if (!sku) continue;
    let qtd = 1;
    for (let i = parts.length - 1; i >= 1; i--) {
      const n = Number(parts[i].replace(",", "."));
      if (Number.isFinite(n) && n > 0) {
        qtd = Math.floor(n);
        break;
      }
    }
    out.push({ sku, quantidade: qtd });
  }
  return out;
}

export default function ImportarItensPedido({
  skuIndex,
  skusNoPedido,
  onImport,
}: {
  /** SKU (lower) -> referência resolvida do catálogo */
  skuIndex: Map<string, ResolvedRef>;
  /** SKUs (lower) já presentes no pedido — pra marcar "somar" */
  skusNoPedido: Set<string>;
  onImport: (itens: ItemImportado[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [lendoArquivo, setLendoArquivo] = useState(false);

  function processar(pares: { sku: string; quantidade: number }[]) {
    if (!pares.length) {
      toast.error("Nada para importar.");
      return;
    }
    // agrega SKUs repetidos somando qtd
    const agg = new Map<string, number>();
    for (const p of pares) {
      const k = p.sku.trim();
      agg.set(k, (agg.get(k) ?? 0) + p.quantidade);
    }
    const res: Linha[] = [];
    for (const [sku, quantidade] of agg) {
      const ref = skuIndex.get(sku.toLowerCase());
      if (!ref) {
        res.push({ sku, quantidade, status: "nao_encontrado" });
      } else if (ref.ambiguo) {
        res.push({ sku, quantidade, status: "ambiguo", ref });
      } else {
        res.push({
          sku,
          quantidade,
          status: skusNoPedido.has(ref.sku.toLowerCase()) ? "somar" : "ok",
          ref,
        });
      }
    }
    setLinhas(res);
  }

  async function lerArquivo(file: File) {
    setLendoArquivo(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: "" });
      const pares: { sku: string; quantidade: number }[] = [];
      for (const r of rows) {
        const sku = String(r[0] ?? "").trim();
        if (!sku || /^(sku|c[óo]digo|interno|item)$/i.test(sku)) continue;
        const q = Number(String(r[1] ?? "1").replace(",", "."));
        pares.push({ sku, quantidade: Number.isFinite(q) && q > 0 ? Math.floor(q) : 1 });
      }
      processar(pares);
    } catch {
      toast.error("Não consegui ler o arquivo.");
    } finally {
      setLendoArquivo(false);
    }
  }

  function aplicar() {
    const validas = (linhas ?? []).filter((l) => l.status === "ok" || l.status === "somar");
    if (!validas.length) {
      toast.error("Nenhum item válido para adicionar.");
      return;
    }
    onImport(
      validas.map((l) => ({
        produto_id: l.ref!.produto_id,
        variacao_id: l.ref!.variacao_id,
        sku: l.ref!.sku,
        nome: l.ref!.nome,
        preco: l.ref!.preco ?? 0,
        quantidade: l.quantidade,
      }))
    );
    const naoEnc = (linhas ?? []).filter((l) => l.status === "nao_encontrado").length;
    const amb = (linhas ?? []).filter((l) => l.status === "ambiguo").length;
    toast.success(
      `${validas.length} item(ns) importado(s).` +
        (naoEnc ? ` ${naoEnc} não encontrado(s).` : "") +
        (amb ? ` ${amb} com variação — adicione manualmente.` : "")
    );
    fechar();
  }

  function fechar() {
    setOpen(false);
    setTexto("");
    setLinhas(null);
  }

  const resumo = linhas
    ? {
        ok: linhas.filter((l) => l.status === "ok").length,
        somar: linhas.filter((l) => l.status === "somar").length,
        amb: linhas.filter((l) => l.status === "ambiguo").length,
        nao: linhas.filter((l) => l.status === "nao_encontrado").length,
      }
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
      >
        <Upload size={15} /> Importar itens
      </button>

      <Modal
        open={open}
        onClose={fechar}
        title="Importar itens por planilha"
        size="lg"
        footer={
          <>
            <button
              onClick={fechar}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
            >
              <X size={14} /> Fechar
            </button>
            {linhas ? (
              <Button onClick={aplicar} disabled={!resumo || resumo.ok + resumo.somar === 0}>
                Adicionar {resumo ? resumo.ok + resumo.somar : 0} itens
              </Button>
            ) : (
              <Button onClick={() => processar(parseTexto(texto))} disabled={!texto.trim()}>
                Processar
              </Button>
            )}
          </>
        }
      >
        {!linhas ? (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              Cole abaixo, um item por linha: <code className="rounded bg-neutral-100 px-1">SKU quantidade</code>{" "}
              (separado por espaço, vírgula, tab ou ponto e vírgula). Sem quantidade = 1.
            </p>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={8}
              placeholder={"GR0001 10\nSA1342;5\n100CR-BG-BC, 3"}
              className="w-full rounded-lg border border-neutral-300 bg-white p-3 font-mono text-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
            />
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <span>ou</span>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50">
                <Upload size={14} /> {lendoArquivo ? "Lendo…" : "Enviar planilha (.xlsx / .csv)"}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) lerArquivo(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-neutral-400">Planilha: coluna 1 = código, coluna 2 = quantidade.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="rounded-full bg-green-50 px-2 py-1 font-medium text-green-700">{resumo!.ok} novos</span>
              <span className="rounded-full bg-blue-50 px-2 py-1 font-medium text-blue-700">{resumo!.somar} somados</span>
              {resumo!.amb > 0 && (
                <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700">{resumo!.amb} c/ variação</span>
              )}
              {resumo!.nao > 0 && (
                <span className="rounded-full bg-red-50 px-2 py-1 font-medium text-red-700">{resumo!.nao} não encontrados</span>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    <th className="px-3 py-2 text-right">Preço</th>
                    <th className="px-3 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {linhas.map((l, i) => (
                    <tr key={i} className={l.status === "nao_encontrado" || l.status === "ambiguo" ? "bg-red-50/40" : ""}>
                      <td className="px-3 py-1.5 font-mono text-xs">{l.sku}</td>
                      <td className="px-3 py-1.5 text-neutral-700">{l.ref?.nome ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right">{l.quantidade}</td>
                      <td className="px-3 py-1.5 text-right">{l.ref?.preco != null ? formatBRL(l.ref.preco) : "—"}</td>
                      <td className="px-3 py-1.5 text-xs">
                        {l.status === "ok" && <span className="text-green-700">adicionar</span>}
                        {l.status === "somar" && <span className="text-blue-700">somar ao existente</span>}
                        {l.status === "ambiguo" && <span className="text-amber-700">tem variações — manual</span>}
                        {l.status === "nao_encontrado" && <span className="text-red-600">não encontrado</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setLinhas(null)} className="text-sm font-medium text-brand hover:underline">
              ← voltar e editar
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
