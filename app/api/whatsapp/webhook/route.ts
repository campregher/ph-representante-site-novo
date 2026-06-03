import { NextResponse, NextRequest } from "next/server";
import { handleWhatsApp }           from "@/lib/whatsapp-bot";
import { getMediaUrl, downloadMedia } from "@/lib/meta-whatsapp";

export const runtime = "nodejs";

// Meta verifica o webhook com GET
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.object !== "whatsapp_business_account") return NextResponse.json({ ok: true });

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;

        const value    = change.value;
        const messages = value?.messages ?? [];

        for (const msg of messages) {
          // Ignora mensagens enviadas pelo próprio número
          if (msg.from === process.env.META_PHONE_NUMBER_ID) continue;

          const phone = msg.from as string;
          const type  = msg.type as string;

          // Texto
          const text: string | null =
            type === "text"     ? (msg.text?.body ?? null) :
            type === "image"    ? (msg.image?.caption ?? null) :
            type === "document" ? null :
            null;

          // Mídia (documento ou imagem)
          const mediaId   = msg.document?.id ?? msg.image?.id ?? null;
          const mediaMime = msg.document?.mime_type ?? msg.image?.mime_type ?? undefined;
          const mediaName = msg.document?.filename ?? (msg.image ? `img-${Date.now()}.jpg` : undefined);

          let mediaBase64: string | null = null;

          if (mediaId) {
            const url    = await getMediaUrl(mediaId);
            const buffer = url ? await downloadMedia(url) : null;
            if (buffer) mediaBase64 = buffer.toString("base64");
          }

          await handleWhatsApp({ phone, text, mediaBase64, mediaName, mediaMime });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[whatsapp/webhook]", err);
    return NextResponse.json({ ok: true });
  }
}
