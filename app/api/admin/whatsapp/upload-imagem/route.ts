import { NextResponse } from "next/server";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";
import { uploadMedia } from "@/lib/meta-whatsapp";

export const runtime = "nodejs";

const MIME_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB       = 5;

export async function POST(request: Request) {
  const store = await cookies();
  if (!await verifyToken(store.get(ADMIN_COOKIE)?.value ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("imagem") as File | null;

  if (!file) return NextResponse.json({ error: "Nenhuma imagem enviada" }, { status: 400 });

  if (!MIME_ACEITOS.includes(file.type)) {
    return NextResponse.json(
      { error: `Formato inválido. Aceito: JPG, PNG, WebP` },
      { status: 400 }
    );
  }

  const bytes = file.size;
  if (bytes > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `Imagem muito grande. Máximo ${MAX_MB}MB` },
      { status: 400 }
    );
  }

  const buffer   = Buffer.from(await file.arrayBuffer());
  const mediaId  = await uploadMedia(buffer, file.type, file.name);

  if (!mediaId) {
    return NextResponse.json({ error: "Falha ao enviar imagem para a Meta. Verifique o token." }, { status: 500 });
  }

  return NextResponse.json({ mediaId, nome: file.name, tamanho: bytes });
}
