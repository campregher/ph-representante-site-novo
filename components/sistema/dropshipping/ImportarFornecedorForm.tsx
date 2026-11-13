"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";
import { importarDropFornecedorCsv, type ImportarFornecedorResultado } from "@/lib/sistema/actions/dropshipping";
import { Button } from "@/components/sistema/ui/Button";
import { Card, CardBody } from "@/components/sistema/ui/Card";

type Modo = "cadastro" | "cadastro_produtos";

const MODELOS: Record<Modo, string> = {
  cadastro: "nome,razao_social,cnpj,telefone,whatsapp,email\nATTIS,ATTIS Acessorios LTDA,12345678000100,1133334444,11999998888,contato@attis.com.br\n",
  cadastro_produtos:
    "fornecedor,sku,nome,descricao,estoque_atual,custo_cpf,preco_sugerido_cpf,custo_cnpj,preco_sugerido_cnpj\nATTIS,ATT-001,Tapete bandeja universal,Tapete de borracha,50,45.90,79.90,32.50,79.90\n",
};

function baixarModelo(modo: Modo) {
  const blob = new Blob([MODELOS[modo]], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = modo === "cadastro" ? "modelo-fornecedores.csv" : "modelo-fornecedores-produtos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportarFornecedorForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modo, setModo] = useState<Modo>("cadastro");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ImportarFornecedorResultado | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function importar() {
    if (!arquivo) { toast.error("Selecione um arquivo CSV."); return; }
    start(async () => {
      const texto = await arquivo.text();
      const res = await importarDropFornecedorCsv(modo, texto);
      if (!res.ok) { toast.error(res.error); return; }
      setResultado(res);
      toast.success(`Importação concluída: ${res.fornecedoresCriados} fornecedor(es), ${res.produtosCriados} produto(s).`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-700">O que importar?</p>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-neutral-700">
                <input type="radio" className="mt-0.5" checked={modo === "cadastro"} onChange={() => setModo("cadastro")} />
                <span>
                  <strong>Só cadastro</strong> — cria só os fornecedores (nome, CNPJ, contato).
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-neutral-700">
                <input type="radio" className="mt-0.5" checked={modo === "cadastro_produtos"} onChange={() => setModo("cadastro_produtos")} />
                <span>
                  <strong>Cadastro + produtos</strong> — cada linha é um produto; cria o fornecedor (se ainda não existir) e o produto com os preços de CPF/CNPJ.
                </span>
              </label>
            </div>
          </div>

          <button type="button" onClick={() => baixarModelo(modo)} className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline">
            <FileText size={14} /> Baixar modelo CSV ({modo === "cadastro" ? "fornecedores" : "fornecedores + produtos"})
          </button>

          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-700">Arquivo CSV</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-neutral-700 hover:file:bg-neutral-200"
            />
          </div>

          <Button onClick={importar} loading={pending} disabled={!arquivo}>
            <Upload size={15} /> Importar
          </Button>
        </CardBody>
      </Card>

      {resultado && (
        <Card>
          <CardBody className="space-y-2 text-sm">
            <p className="font-semibold text-neutral-900">Resultado</p>
            <p className="text-neutral-600">{resultado.fornecedoresCriados} fornecedor(es) criado(s), {resultado.produtosCriados} produto(s) criado(s).</p>
            {resultado.erros.length > 0 && (
              <div className="mt-2 space-y-1 rounded-md bg-red-50 p-3">
                {resultado.erros.map((e, i) => (
                  <p key={i} className="text-xs text-red-700">{e}</p>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
