import { NextResponse } from "next/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { getAppAccessToken, mlConfigurado } from "@/lib/sistema/ml-auth";
import { predizerCategoriaML } from "@/lib/sistema/ml-catalogo";

export const runtime = "nodejs";

/** Sugestão de categoria do ML pro cadastro de produto próprio (admin). */
export async function GET(req: Request) {
  const profile = await getSistemaProfile();
  if (!profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!mlConfigurado()) return NextResponse.json({ error: "Mercado Livre não configurado." }, { status: 503 });

  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const token = await getAppAccessToken();
    const sugestoes = await predizerCategoriaML(q, token);
    return NextResponse.json(sugestoes);
  } catch {
    return NextResponse.json({ error: "Falha ao consultar categorias do Mercado Livre." }, { status: 502 });
  }
}
