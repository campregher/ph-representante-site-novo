import { NextResponse } from "next/server";
import { buscarCnpj } from "@/lib/sistema/cnpj";

export const runtime = "nodejs";

/** Mesma consulta de CNPJ da área interna, sem exigir login — usada no
 *  auto-cadastro público de seller (/drop/cadastro). */
export async function GET(_req: Request, { params }: { params: Promise<{ cnpj: string }> }) {
  const { cnpj } = await params;
  const clean = cnpj.replace(/\D/g, "");
  const resultado = await buscarCnpj(clean);
  if ("error" in resultado) return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  return NextResponse.json(resultado.data);
}
