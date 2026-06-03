import { NextResponse } from "next/server";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";
import { sendText } from "@/lib/evolution";
import { sendImage } from "@/lib/meta-whatsapp";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min para listas grandes

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function normalizePhone(raw: string): string | null {
  const digits = String(raw).replace(/\D/g, "");
  // Aceita 10-13 dígitos — adiciona 55 se não tiver código do Brasil
  if (digits.length === 11) return `55${digits}`;      // (11) 99999-9999
  if (digits.length === 10) return `55${digits}`;      // (11) 9999-9999
  if (digits.length === 13) return digits;             // 5511999999999
  if (digits.length === 12) return digits;             // 551199999999
  return null;
}

async function isAdmin() {
  const store = await cookies();
  return await verifyToken(store.get(ADMIN_COOKIE)?.value ?? "");
}

export async function POST(request: Request) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { contatos, mensagem, imagemId, delayMs = 1000 } = await request.json() as {
    contatos:  { telefone: string; nome: string; [k: string]: string }[];
    mensagem:  string;
    imagemId?: string | null;
    delayMs?:  number;
  };

  if (!contatos?.length) return NextResponse.json({ error: "Lista vazia" }, { status: 400 });
  if (!mensagem?.trim()) return NextResponse.json({ error: "Mensagem obrigatória" }, { status: 400 });

  const resultados: { telefone: string; nome: string; status: "ok" | "erro"; motivo?: string }[] = [];

  for (const c of contatos) {
    const phone = normalizePhone(c.telefone);
    const nome  = c.nome ?? "";

    if (!phone) {
      resultados.push({ telefone: c.telefone, nome, status: "erro", motivo: "Número inválido" });
      continue;
    }

    // Substitui variáveis {{nome}}, {{empresa}}, {{telefone}}, {{email}}, etc.
    const texto = mensagem
      .replace(/\{\{nome\}\}/gi,     nome)
      .replace(/\{\{empresa\}\}/gi,  c.empresa ?? "")
      .replace(/\{\{telefone\}\}/gi, c.telefone)
      .replace(/\{\{email\}\}/gi,    c.email ?? "")
      .replace(/\{\{(\w+)\}\}/gi, (_, key) => c[key] ?? "");

    try {
      if (imagemId) {
        // Envia imagem com o texto como legenda
        await sendImage(phone, imagemId, texto || undefined);
      } else {
        await sendText(phone, texto);
      }
      resultados.push({ telefone: phone, nome, status: "ok" });
    } catch {
      resultados.push({ telefone: phone, nome, status: "erro", motivo: "Falha no envio" });
    }

    await delay(delayMs);
  }

  const ok    = resultados.filter(r => r.status === "ok").length;
  const erros = resultados.filter(r => r.status === "erro").length;

  return NextResponse.json({ ok, erros, resultados });
}
