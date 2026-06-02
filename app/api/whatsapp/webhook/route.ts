import { NextResponse }    from "next/server";
import { handleWhatsApp } from "@/lib/whatsapp-bot";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Only handle incoming client messages
    if (body.event !== "messages.upsert") return NextResponse.json({ ok: true });

    const data = body.data;
    if (!data?.key || data.key.fromMe) return NextResponse.json({ ok: true });

    const jid = data.key.remoteJid as string;
    // Ignore groups and broadcast
    if (!jid || jid.includes("@g.us") || jid.includes("@broadcast")) return NextResponse.json({ ok: true });

    const phone = jid.split("@")[0];
    const msg   = data.message as Record<string, unknown> | undefined;
    if (!msg) return NextResponse.json({ ok: true });

    const docMsg = msg.documentMessage as Record<string, unknown> | null;
    const imgMsg = msg.imageMessage   as Record<string, unknown> | null;
    const hasMedia = !!(docMsg || imgMsg);

    const text: string | null =
      (msg.conversation as string | null) ??
      ((msg.extendedTextMessage as Record<string, unknown> | null)?.text as string | null) ??
      ((imgMsg?.caption) as string | null) ??
      null;

    await handleWhatsApp({
      phone,
      text,
      msgKey:     hasMedia ? (data.key as Record<string, unknown>) : undefined,
      msgContent: hasMedia ? msg : undefined,
      mediaName:  (docMsg?.fileName as string | null) ?? (imgMsg ? `img-${Date.now()}.jpg` : undefined),
      mediaMime:  (docMsg?.mimetype as string | null) ?? (imgMsg?.mimetype as string | null) ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[whatsapp/webhook]", err);
    return NextResponse.json({ ok: true }); // Always 200 — avoid Evolution API retries
  }
}

// Evolution API health check
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
