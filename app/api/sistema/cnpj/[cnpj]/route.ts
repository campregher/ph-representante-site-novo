import { NextResponse } from "next/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import type { CnpjData } from "@/lib/sistema/cnpj";

export const runtime = "nodejs";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(_req: Request, { params }: { params: Promise<{ cnpj: string }> }) {
  const profile = await getSistemaProfile();
  if (!profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { cnpj } = await params;
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) {
    return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 });
  }

  // 1) CNPJá aberto — inclui inscrição estadual (registrations)
  try {
    const r = await fetch(`https://open.cnpja.com/office/${clean}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (r.ok) {
      const d: any = await r.json();
      const regs: any[] = Array.isArray(d.registrations) ? d.registrations : [];
      const reg = regs.find((x) => x.enabled) ?? regs[0] ?? null;
      const ph = Array.isArray(d.phones) && d.phones[0] ? d.phones[0] : null;
      const data: CnpjData = {
        fonte: "cnpja",
        razao_social: d.company?.name ?? "",
        nome_fantasia: d.alias ?? "",
        inscricao_estadual: reg?.number ?? "",
        cep: String(d.address?.zip ?? "").replace(/\D/g, ""),
        logradouro: d.address?.street ?? "",
        numero: String(d.address?.number ?? ""),
        complemento: d.address?.details ?? "",
        bairro: d.address?.district ?? "",
        cidade: d.address?.city ?? "",
        estado: d.address?.state ?? "",
        telefone: ph ? `(${ph.area}) ${ph.number}` : "",
        email: Array.isArray(d.emails) && d.emails[0] ? d.emails[0].address : "",
        situacao: d.status?.text ?? "",
      };
      return NextResponse.json(data);
    }
    if (r.status === 404)
      return NextResponse.json({ error: "CNPJ não encontrado na Receita." }, { status: 404 });
  } catch {
    /* cai no fallback */
  }

  // 2) Fallback BrasilAPI (sem inscrição estadual)
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (r.ok) {
      const d: any = await r.json();
      const tel = d.ddd_telefone_1 ? String(d.ddd_telefone_1) : "";
      const data: CnpjData = {
        fonte: "brasilapi",
        razao_social: d.razao_social ?? "",
        nome_fantasia: d.nome_fantasia ?? "",
        inscricao_estadual: "",
        cep: String(d.cep ?? "").replace(/\D/g, ""),
        logradouro: [d.descricao_tipo_logradouro, d.logradouro].filter(Boolean).join(" "),
        numero: String(d.numero ?? ""),
        complemento: d.complemento ?? "",
        bairro: d.bairro ?? "",
        cidade: d.municipio ?? "",
        estado: d.uf ?? "",
        telefone: tel ? `(${tel.slice(0, 2)}) ${tel.slice(2)}` : "",
        email: d.email ?? "",
        situacao: d.descricao_situacao_cadastral ?? "",
      };
      return NextResponse.json(data);
    }
    if (r.status === 404)
      return NextResponse.json({ error: "CNPJ não encontrado na Receita." }, { status: 404 });
    if (r.status === 429)
      return NextResponse.json(
        { error: "Muitas consultas seguidas. Aguarde alguns segundos." },
        { status: 429 }
      );
  } catch {
    /* ignora */
  }

  return NextResponse.json(
    { error: "Não foi possível consultar o CNPJ agora. Tente novamente." },
    { status: 502 }
  );
}
