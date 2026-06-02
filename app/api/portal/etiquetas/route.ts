import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    if (!files.length) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

    const admin = await createAdminClient();
    const uploaded: { nome: string; url: string }[] = [];

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error } = await admin.storage
        .from("etiquetas")
        .upload(path, buffer, { contentType: file.type, upsert: false });

      if (error) throw new Error(error.message);

      const { data: { publicUrl } } = admin.storage.from("etiquetas").getPublicUrl(path);
      uploaded.push({ nome: file.name, url: publicUrl });
    }

    return NextResponse.json(uploaded);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
