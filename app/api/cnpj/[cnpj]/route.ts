import { NextResponse } from "next/server";

const AUTOMOTIVE_CNAES = ["45"];

export async function GET(_: Request, { params }: { params: Promise<{ cnpj: string }> }) {
  try {
    const { cnpj } = await params;
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });

    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PH-Representante/1.0; +https://phrepresentante.com.br)",
        "Accept": "application/json",
      },
    });
    if (!res.ok) {
      const status = res.status;
      if (status === 404) return NextResponse.json({ error: "CNPJ não encontrado na Receita Federal" }, { status: 404 });
      if (status === 429) return NextResponse.json({ error: "Muitas consultas. Aguarde alguns segundos e tente novamente." }, { status: 429 });
      return NextResponse.json({ error: `Erro na consulta (${status})` }, { status: 502 });
    }

    const data = await res.json();

    if (data.descricao_situacao_cadastral?.toUpperCase() !== "ATIVA") {
      return NextResponse.json({ error: "CNPJ com situação cadastral inativa" }, { status: 422 });
    }

    const cnaeCode = String(data.cnae_fiscal ?? "");
    const isAutomotive =
      AUTOMOTIVE_CNAES.some((prefix) => cnaeCode.startsWith(prefix)) ||
      (data.cnaes_secundarios ?? []).some((c: { codigo: number }) =>
        AUTOMOTIVE_CNAES.some((prefix) => String(c.codigo).startsWith(prefix))
      );

    return NextResponse.json({
      cnpj: data.cnpj,
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia || "",
      cnae_codigo: cnaeCode,
      cnae_descricao: data.cnae_fiscal_descricao || "",
      is_automotive: isAutomotive,
      cep: (data.cep ?? "").replace(/\D/g, ""),
      logradouro: [data.descricao_tipo_logradouro, data.logradouro].filter(Boolean).join(" "),
      numero: data.numero || "",
      complemento: data.complemento || "",
      bairro: data.bairro || "",
      cidade: data.municipio || "",
      estado: data.uf || "",
      telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0,2)}) ${data.ddd_telefone_1.substring(2)}` : "",
      email: data.email || "",
    });
  } catch {
    return NextResponse.json({ error: "Erro ao consultar CNPJ" }, { status: 500 });
  }
}
