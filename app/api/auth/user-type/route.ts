import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Receives an access_token, decodes it (no verification needed — just for routing),
// checks if the user is in marca_users and returns "marca" or "portal"
export async function POST(request: Request) {
  try {
    const { access_token } = await request.json();
    if (!access_token) return NextResponse.json({ type: "portal" });

    const parts = access_token.split(".");
    if (parts.length !== 3) return NextResponse.json({ type: "portal" });

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    const userId = payload.sub as string | undefined;
    if (!userId) return NextResponse.json({ type: "portal" });

    const db = await createAdminClient();
    const { data } = await db.from("marca_users").select("id").eq("user_id", userId).single();

    return NextResponse.json({ type: data ? "marca" : "portal" });
  } catch {
    return NextResponse.json({ type: "portal" });
  }
}
