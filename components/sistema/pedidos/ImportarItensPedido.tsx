"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileUp, Upload } from "lucide-react";
import { Button } from "@/components/sistema/ui/Button";
import { Modal } from "@/components/sistema/ui/Modal";

export interface LinhaImport {
  codigo: string;
  qtd: number;
}

/** "SL078<TAB>2" / "SL078;2" / "SL078,2" — uma linha por item. */
export function parseTexto(txt: string): LinhaImport[] {
  const out: LinhaImport[] = [];
  txt.split(/\r?\n/).forEach((raw, i) => {
    const linha = raw.trim();
    if (!linha) return;
    const parts = linha.split(/\t|;|,/).map((c) => c.trim());
    const codigo = parts[0] ?? "";
    const qtdRaw = (parts[1] ?? "").replace(/[^\d.,-]/g, "");
    const qtd = Math.floor(Number(qtdRaw.replace(",", ".")) || 0);
    // pula cabeçalho na 1ª linha (qtd não numérica ou texto tipo "código/qtd")
    if (i === 0 && (!qtdRaw || Number.isNaN(qtd) || /c[oó]d|sku|qtd|quant/i.test(linha))) return;
    if (!codigo) return;
    out.push({ codigo, qtd: qtd > 0 ? qtd : 1 });
  });
  return out;
}

async function parseArquivo(file: File): Promise<LinhaImport[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  if (matrix.length === 0) return [];

  const head = (matrix[0] as unknown[]).map((c) => String(c ?? "").trim().toLowerCase());
  let ci = head.findIndex((h) => /c[oó]d|sku|refer/.test(h));
  let qi = head.findIndex((h) => /qtd|quant|qnt/.test(h));
  const primeiraQtd = Number(String((matrix[0] as unknown[])[qi >= 0 ? qi : 1] ?? "").replace(",", "."));
  const temHeader = ci >= 0 || qi >= 0 || !Number.isFinite(primeiraQtd);
  if (ci < 0) ci = 0;
  if (qi < 0) qi = 1;

  const out: LinhaImport[] = [];
  for (let r = temHeader ? 1 : 0; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    const codigo = String(row[ci] ?? "").trim();
    if (!codigo) continue;
    const qtd = Math.floor(Number(String(row[qi] ?? "").replace(",", ".")) || 0);
    out.push({ codigo, qtd: qtd > 0 ? qtd : 1 });
  }
  return out;
}

export default function ImportarItensPedido({
  disabled,
  onAdd,
}: {
  disabled?: boolean;
  onAdd: (linhas: LinhaImport[]) => { adicionados: number; naoEncontrados: string[] };
}) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [busy, start] = useTransition();
  const [naoEnc, setNaoEnc] = useState<string[] | null>(null);

  const previa = useMemo(() => parseTexto(texto), [texto]);

  function aplicar(linhas: LinhaImport[]) {
    if (linhas.length === 0) {
      toast.error("Nada para importar — verifique as colunas código e quantidade.");
      return;
    }
    const res = onAdd(linhas);
    setNaoEnc(res.naoEncontrados);
    if (res.adicionados > 0) toast.success(`${res.adicionados} item(ns) adicionado(s) ao pedido.`);
    if (res.naoEncontrados.length > 0) {
      toast.warning(`${res.naoEncontrados.length} código(s) não encontrado(s) nesta representada.`);
    } else {
      setOpen(false);
      setTexto("");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setNaoEnc(null);
          setOpen(true);
        }}
      >
        <FileUp size={14} /> Importar planilha
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Importar itens por planilha"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button
              size="sm"
              loading={busy}
              disabled={previa.length === 0}
              onClick={() => aplicar(previa)}
            >
              Adicionar {previa.length || ""}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-neutral-500">
            Duas colunas: <b>código</b> (SKU) e <b>quantidade</b>. Cole direto do Excel
            (uma linha por item) ou envie um arquivo <code>.xlsx</code>/<code>.csv</code>.
            Os códigos são casados com os produtos ativos da representada selecionada.
          </p>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-xs text-neutral-600 hover:border-brand/40">
            <Upload size={14} /> Escolher arquivo (.xlsx, .xls, .csv)
            <input
              type="file"
              accept=".xlsx,.xls,.csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                start(async () => {
                  try {
                    aplicar(await parseArquivo(f));
                  } catch {
                    toast.error("Não consegui ler o arquivo.");
                  }
                });
              }}
            />
          </label>

          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={"SL078\t2\nTAP-001\t5\nCAL-014\t1"}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
          />
          {texto.trim() && (
            <p className="text-xs text-neutral-400">{previa.length} linha(s) reconhecida(s).</p>
          )}

          {naoEnc && naoEnc.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
              <b>Não encontrados nesta representada</b> (nada foi adicionado para estes):
              <div className="mt-1 break-words font-mono">{naoEnc.join(", ")}</div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
