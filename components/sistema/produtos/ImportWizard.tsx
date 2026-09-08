"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Upload, CheckCircle2, ArrowRight, ArrowLeft, FileDown } from "lucide-react";
import { parseNumeroBR } from "@/lib/sistema/format";
import { importProdutos, type ImportResumo } from "@/lib/sistema/actions/produtos";
import { Card, CardBody, CardHeader } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Select, Checkbox } from "@/components/sistema/ui/Field";
import {
  TableScroll,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@/components/sistema/ui/Table";

type Parsed = {
  columns: string[];
  rows: Record<string, string | number>[];
  total: number;
  truncated?: boolean;
};

type FieldKind = "text" | "num" | "int";
interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  guess: RegExp;
  required?: boolean;
  main?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: "sku", label: "SKU / Código", kind: "text", guess: /^(sku|c[oó]d(igo)?|cod_?fab|refer[eê]ncia|ref)\b/i, required: true, main: true },
  { key: "nome", label: "Nome", kind: "text", guess: /^(nome|produto|descri[cç][aã]o\s*curta|t[ií]tulo|title)/i, main: true },
  { key: "descricao", label: "Descrição", kind: "text", guess: /(descri[cç][aã]o(?!\s*curta)|detalhe|especifica)/i, main: true },
  { key: "preco_bruto", label: "Preço bruto (R$)", kind: "num", guess: /(pre[cç]o|valor|custo|bruto|tabela|lista)/i, main: true },
  { key: "codigo_fabrica", label: "Código de fábrica", kind: "text", guess: /(c[oó]d.*f[aá]brica|cod_?fab|fabricante)/i },
  { key: "ean", label: "EAN / GTIN", kind: "text", guess: /\b(ean|gtin|c[oó]d.*barra)\b/i },
  { key: "ncm", label: "NCM", kind: "text", guess: /\bncm\b/i },
  { key: "marca", label: "Marca", kind: "text", guess: /\bmarca\b/i },
  { key: "aplicacao", label: "Aplicação", kind: "text", guess: /aplica[cç][aã]o/i },
  { key: "montadora", label: "Montadora", kind: "text", guess: /montadora|fabricante.*ve[íi]culo/i },
  { key: "modelo", label: "Modelo", kind: "text", guess: /\bmodelo\b/i },
  { key: "ano_inicio", label: "Ano início", kind: "int", guess: /ano.*(in[íi]cio|de)|\bano_?ini\b/i },
  { key: "ano_fim", label: "Ano fim", kind: "int", guess: /ano.*(fim|at[eé])|\bano_?fim\b/i },
  { key: "unidade", label: "Unidade", kind: "text", guess: /unidade|\bun\b|\bum\b/i },
  { key: "categoria", label: "Categoria", kind: "text", guess: /categoria|grupo|linha|fam[íi]lia/i },
  { key: "peso", label: "Peso embalagem (kg)", kind: "num", guess: /peso|\bkg\b|gramatura/i },
  { key: "altura", label: "Altura (cm)", kind: "num", guess: /altura|\balt\b/i },
  { key: "largura", label: "Largura (cm)", kind: "num", guess: /largura|\blarg\b/i },
  { key: "comprimento", label: "Comprimento (cm)", kind: "num", guess: /comprimento|profundidade|\bcompr\b|\bprof\b/i },
  { key: "imagem_url", label: "Foto (link)", kind: "text", guess: /(foto|imagem|image|url.*foto|link.*foto|picture|\bimg\b)/i },
  { key: "observacoes", label: "Observações", kind: "text", guess: /observa|\bobs\b|coment/i },
  { key: "ativo", label: "Ativo (sim/não)", kind: "text", guess: /\bativo\b|status.*produto|habilitado/i },
];
const MAIN_FIELDS = FIELDS.filter((f) => f.main);
const EXTRA_FIELDS = FIELDS.filter((f) => !f.main);

// A importação vai numa Server Action; o corpo é limitado (~1 MB por padrão).
// Enviamos em lotes para não estourar esse limite nem o tempo da função.
const IMPORT_CHUNK_SIZE = 400;

export default function ImportWizard({
  representadaOptions,
}: {
  representadaOptions: { id: string; label: string }[];
}) {
  const [step, setStep] = useState(1);
  const [representadaId, setRepresentadaId] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [skuPaiCol, setSkuPaiCol] = useState("");
  const [eixoCols, setEixoCols] = useState<string[]>([]);
  const [options, setOptions] = useState({
    criarNovos: true,
    atualizarDados: false,
    ignorarDuplicados: false,
  });
  const [importing, startImport] = useTransition();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [resumo, setResumo] = useState<ImportResumo | null>(null);

  async function baixarModelo() {
    const XLSX = await import("xlsx");
    const header = [
      "SKU", "SKU Pai", "Estofado", "Costura", "Nome", "Descrição", "Preço bruto",
      "Código de fábrica", "EAN", "NCM", "Marca", "Aplicação", "Montadora", "Modelo",
      "Ano início", "Ano fim", "Unidade", "Categoria", "Peso (kg)", "Altura (cm)",
      "Largura (cm)", "Comprimento (cm)", "Foto", "Ativo",
    ];
    const b = (o: Record<string, string>) => {
      const row: Record<string, string> = {};
      for (const h of header) row[h] = o[h] ?? "";
      return row;
    };
    const linhas = [
      b({
        SKU: "TAP-001", Nome: "Tapete de borracha universal", Descrição: "Jogo 4 peças, preto",
        "Preço bruto": "129,90", "Código de fábrica": "TB-4P", EAN: "7890000000017", NCM: "87082999",
        Marca: "ATTIS", Aplicação: "Assoalho", Montadora: "VW", Modelo: "Gol",
        "Ano início": "2013", "Ano fim": "2023", Unidade: "JG", Categoria: "Tapetes",
        "Peso (kg)": "2,4", Foto: "https://exemplo.com/tap-001.jpg", Ativo: "sim",
      }),
      // Produto com variações: a 1ª linha é o pai; as seguintes são as variações
      b({
        SKU: "APB-HB20", Nome: "Apoio de braço HB20", Descrição: "Central, encaixe no console",
        "Preço bruto": "159,90", Marca: "ATTIS", Aplicação: "Console central",
        Montadora: "Hyundai", Modelo: "HB20", Categoria: "Apoio de braço", Ativo: "sim",
      }),
      b({
        SKU: "APB-HB20-COURO-SIMPLES", "SKU Pai": "APB-HB20", Estofado: "Couro", Costura: "Simples",
        "Preço bruto": "189,90", Ativo: "sim",
      }),
      b({
        SKU: "APB-HB20-COURO-DUPLAV", "SKU Pai": "APB-HB20", Estofado: "Couro", Costura: "Dupla vermelha",
        "Preço bruto": "199,90", Ativo: "sim",
      }),
      b({
        SKU: "APB-HB20-TECIDO-SIMPLES", "SKU Pai": "APB-HB20", Estofado: "Tecido", Costura: "Simples",
        "Preço bruto": "", Ativo: "sim",
      }),
    ];
    const ws = XLSX.utils.json_to_sheet(linhas, { header });
    ws["!cols"] = header.map((h) => ({ wch: /nome|descri|foto|aplica|sku/i.test(h) ? 26 : 13 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "modelo-importacao-produtos.xlsx");
  }

  async function handleFile(file: File) {
    setParsing(true);
    setParsed(null);
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/sistema/produtos/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Falha ao ler o arquivo.");
        return;
      }
      const p = json as Parsed;
      setParsed(p);
      const nextMap: Record<string, string> = {};
      for (const f of FIELDS) {
        const hit = p.columns.find((c) => f.guess.test(c));
        if (hit && !Object.values(nextMap).includes(hit)) nextMap[f.key] = hit;
      }
      setMapping(nextMap);
      const paiHit = p.columns.find(
        (c) => /sku.?pai|produto.?pai|\bpai\b/i.test(c) && c !== nextMap.sku
      );
      setSkuPaiCol(paiHit ?? "");
      setEixoCols([]);
      setStep(3);
    } catch {
      toast.error("Falha ao enviar o arquivo.");
    } finally {
      setParsing(false);
    }
  }

  const mappedRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows
      .map((raw) => {
        const row: Record<string, unknown> = {};
        for (const f of FIELDS) {
          const col = mapping[f.key];
          if (!col) continue;
          const v = raw[col];
          row[f.key] = f.kind === "text" ? String(v ?? "").trim() : parseNumeroBR(v as string);
        }
        if (skuPaiCol) row.sku_pai = String(raw[skuPaiCol] ?? "").trim();
        if (eixoCols.length) {
          row.variacao_eixos = eixoCols
            .map((c) => ({ nome: c, valor: String(raw[c] ?? "").trim() }))
            .filter((e) => e.valor);
        }
        return row;
      })
      .filter((r) => r.sku);
  }, [parsed, mapping, skuPaiCol, eixoCols]);

  function runImport() {
    // Deduplica por SKU (último vence) — mesma regra da action — e envia em lotes
    // para não estourar o limite de corpo da Server Action.
    const bySku = new Map<string, Record<string, unknown>>();
    for (const r of mappedRows) {
      const key = String(r.sku ?? "").trim().toLowerCase();
      if (key) bySku.set(key, r);
    }
    const todas = [...bySku.values()] as unknown as Parameters<
      typeof importProdutos
    >[0]["rows"];

    startImport(async () => {
      setProgress({ done: 0, total: todas.length });
      const acc: ImportResumo = {
        criados: 0,
        atualizados: 0,
        categoriasCriadas: 0,
        ignorados: 0,
        erros: 0,
        variacoesCriadas: 0,
        variacoesAtualizadas: 0,
      };

      for (let i = 0; i < todas.length; i += IMPORT_CHUNK_SIZE) {
        const lote = todas.slice(i, i + IMPORT_CHUNK_SIZE);
        const res = await importProdutos({ representadaId, rows: lote, options });
        if (!res.ok) {
          setProgress(null);
          toast.error(
            `${res.error} (falhou entre as linhas ${i + 1}–${i + lote.length})`
          );
          return;
        }
        const r = res.resumo;
        if (r) {
          acc.criados += r.criados;
          acc.atualizados += r.atualizados;
          acc.categoriasCriadas += r.categoriasCriadas;
          acc.ignorados += r.ignorados;
          acc.erros += r.erros;
          acc.variacoesCriadas += r.variacoesCriadas ?? 0;
          acc.variacoesAtualizadas += r.variacoesAtualizadas ?? 0;
        }
        setProgress({
          done: Math.min(i + IMPORT_CHUNK_SIZE, todas.length),
          total: todas.length,
        });
      }

      setProgress(null);
      setResumo(acc);
      setStep(5);
      toast.success("Importação concluída.");
    });
  }

  function reset() {
    setStep(1);
    setParsed(null);
    setResumo(null);
    setProgress(null);
    setFileName("");
    setMapping({});
    setSkuPaiCol("");
    setEixoCols([]);
  }

  const colOptions = (parsed?.columns ?? []).map((c) => (
    <option key={c} value={c}>
      {c}
    </option>
  ));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Stepper step={step} />
        <Button type="button" variant="outline" size="sm" onClick={baixarModelo}>
          <FileDown size={14} /> Baixar modelo
        </Button>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader
            title="1. Representada"
            description="A planilha traz os dados do produto + o preço bruto. As tabelas de desconto são criadas no sistema."
          />
          <CardBody className="space-y-4">
            <Field label="Representada" required>
              <Select value={representadaId} onChange={(e) => setRepresentadaId(e.target.value)}>
                <option value="">Selecione…</option>
                {representadaOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex justify-end">
              <Button disabled={!representadaId} onClick={() => setStep(2)}>
                Continuar <ArrowRight size={15} />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader title="2. Enviar planilha" />
          <CardBody className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center hover:border-brand/40">
              <Upload size={24} className="text-neutral-400" />
              <span className="text-sm font-medium text-neutral-700">
                {parsing ? "Lendo…" : "Clique para escolher o arquivo"}
              </span>
              <span className="text-xs text-neutral-400">.xlsx, .xls ou .csv — até 8 MB</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={parsing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
            {fileName && <p className="text-xs text-neutral-500">Arquivo: {fileName}</p>}
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft size={15} /> Voltar
            </Button>
          </CardBody>
        </Card>
      )}

      {step === 3 && parsed && (
        <Card>
          <CardHeader
            title="3. Relacionar colunas"
            description={`${parsed.total} linha(s)${parsed.truncated ? " (limitado a 5000)" : ""}`}
          />
          <CardBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {MAIN_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} required={f.required}>
                  <Select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                  >
                    <option value="">— ignorar —</option>
                    {colOptions}
                  </Select>
                </Field>
              ))}
            </div>

            <details className="rounded-lg border border-neutral-200" open>
              <summary className="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Campos adicionais (opcional)
              </summary>
              <div className="grid gap-4 p-4 pt-0 sm:grid-cols-3">
                {EXTRA_FIELDS.map((f) => (
                  <Field key={f.key} label={f.label}>
                    <Select
                      value={mapping[f.key] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    >
                      <option value="">— ignorar —</option>
                      {colOptions}
                    </Select>
                  </Field>
                ))}
              </div>
            </details>

            <details className="rounded-lg border border-neutral-200" open={!!skuPaiCol}>
              <summary className="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Variações (opcional)
              </summary>
              <div className="space-y-3 p-4 pt-0">
                <Field
                  label="Coluna do SKU do produto pai"
                  hint="Linhas com esse SKU (≠ do SKU da linha) viram variações do produto pai."
                >
                  <Select value={skuPaiCol} onChange={(e) => setSkuPaiCol(e.target.value)}>
                    <option value="">— nenhuma (sem variações) —</option>
                    {colOptions}
                  </Select>
                </Field>
                {skuPaiCol && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-neutral-500">
                      Colunas de eixo de variação
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(parsed?.columns ?? [])
                        .filter((c) => c !== skuPaiCol && c !== mapping.sku)
                        .map((c) => {
                          const on = eixoCols.includes(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() =>
                                setEixoCols((s) =>
                                  on ? s.filter((x) => x !== c) : [...s, c]
                                )
                              }
                              className={`rounded-full border px-2.5 py-1 text-xs ${
                                on
                                  ? "border-brand bg-brand/10 font-semibold text-brand"
                                  : "border-neutral-300 text-neutral-600 hover:border-neutral-400"
                              }`}
                            >
                              {c}
                            </button>
                          );
                        })}
                    </div>
                    <p className="mt-1.5 text-xs text-neutral-400">
                      Ex.: marque “Estofado” e “Costura”. O cabeçalho da coluna vira o nome do eixo.
                    </p>
                  </div>
                )}
              </div>
            </details>

            <div>
              <p className="mb-2 text-xs font-semibold text-neutral-500">Prévia (5 primeiras)</p>
              <TableScroll>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>SKU</Th>
                      {skuPaiCol && <Th>Variação de</Th>}
                      <Th>Nome</Th>
                      <Th className="text-right">Preço bruto</Th>
                      <Th>Categoria</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {mappedRows.slice(0, 5).map((r, i) => (
                      <Tr key={i}>
                        <Td className="font-mono text-xs">{r.sku as string}</Td>
                        {skuPaiCol && (
                          <Td className="font-mono text-xs text-neutral-500">
                            {(r.sku_pai as string) || "—"}
                          </Td>
                        )}
                        <Td>{(r.nome as string) || "—"}</Td>
                        <Td className="text-right">
                          {r.preco_bruto != null ? (r.preco_bruto as number) : "—"}
                        </Td>
                        <Td>{(r.categoria as string) || "—"}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableScroll>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft size={15} /> Voltar
              </Button>
              <Button disabled={!mapping.sku || mappedRows.length === 0} onClick={() => setStep(4)}>
                Continuar <ArrowRight size={15} />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 4 && parsed && (
        <Card>
          <CardHeader title="4. Opções e confirmação" description={`${mappedRows.length} produto(s)`} />
          <CardBody className="space-y-4">
            <div className="space-y-2 rounded-lg border border-neutral-200 p-4">
              <Checkbox
                checked={options.criarNovos}
                onChange={(e) => setOptions((o) => ({ ...o, criarNovos: e.target.checked }))}
                label="Criar produtos novos (SKU inexistente nesta representada)"
              />
              <Checkbox
                checked={options.atualizarDados}
                onChange={(e) => setOptions((o) => ({ ...o, atualizarDados: e.target.checked }))}
                label="Atualizar todos os dados mapeados (inclusive preço bruto) de produtos existentes"
              />
              <Checkbox
                checked={options.ignorarDuplicados}
                onChange={(e) => setOptions((o) => ({ ...o, ignorarDuplicados: e.target.checked }))}
                label="Não alterar SKUs que já existem"
              />
            </div>
            <p className="text-xs text-neutral-500">
              Depois da importação, crie as tabelas de preço (desconto %) em <b>Tabelas de Preço</b>.
            </p>
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(3)} disabled={importing}>
                <ArrowLeft size={15} /> Voltar
              </Button>
              <div className="flex items-center gap-3">
                {importing && progress && (
                  <span className="text-xs text-neutral-500">
                    {progress.done}/{progress.total}…
                  </span>
                )}
                <Button onClick={runImport} loading={importing}>
                  Importar
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 5 && resumo && (
        <Card>
          <CardBody className="py-10 text-center">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-green-500" />
            <h3 className="text-lg font-bold text-neutral-900">Importação concluída</h3>
            <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-2 text-sm">
              <Stat label="Criados" value={resumo.criados} />
              <Stat label="Atualizados" value={resumo.atualizados} />
              <Stat label="Categorias criadas" value={resumo.categoriasCriadas} />
              <Stat label="Ignorados" value={resumo.ignorados} />
              {resumo.variacoesCriadas > 0 && (
                <Stat label="Variações criadas" value={resumo.variacoesCriadas} />
              )}
              {resumo.variacoesAtualizadas > 0 && (
                <Stat label="Variações atualizadas" value={resumo.variacoesAtualizadas} />
              )}
              {resumo.erros > 0 && <Stat label="Erros" value={resumo.erros} />}
            </div>
            <div className="mt-6 flex justify-center gap-2">
              <Link
                href={`/sistema/produtos?representada=${representadaId}`}
                className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                Ver produtos
              </Link>
              <Link
                href={`/sistema/tabelas/nova?representada=${representadaId}`}
                className="inline-flex h-10 items-center rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Criar tabela de desconto
              </Link>
              <button
                onClick={reset}
                className="inline-flex h-10 items-center rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Nova importação
              </button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Representada", "Planilha", "Colunas", "Confirmar"];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {labels.map((l, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={l} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full font-bold ${
                done
                  ? "bg-green-100 text-green-700"
                  : active
                    ? "bg-brand text-white"
                    : "bg-neutral-200 text-neutral-500"
              }`}
            >
              {n}
            </span>
            <span className={active ? "font-semibold text-neutral-800" : "text-neutral-400"}>{l}</span>
            {n < labels.length && <span className="text-neutral-300">›</span>}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-2">
      <div className="text-lg font-bold text-neutral-900">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}
