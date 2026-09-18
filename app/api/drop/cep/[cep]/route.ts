import { NextResponse } from "next/server";
import { buscarCep } from "@/lib/sistema/cep";

export const runtime = "nodejs";

/** Consulta de CEP pública (sem login) — usada no auto-cadastro de seller (/drop/cadastro). */
export async function GET(_req: Request, { params }: { params: Promise<{ cep: string }> }) {
  const { cep } = await params;
  const clean = cep.replace(/\D/g, "");
  const resultado = await buscarCep(clean);
  if ("error" in resultado) return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  return NextResponse.json(resultado.data);
}
