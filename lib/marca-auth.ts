import { createClient, createAdminClient } from "@/lib/supabase/server";

export interface MarcaUser {
  userId: string;
  email: string;
  marcaSlug: string;
}

export async function getMarcaUser(): Promise<MarcaUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = await createAdminClient();
    const { data } = await admin
      .from("marca_users")
      .select("marca_slug")
      .eq("user_id", user.id)
      .single();

    if (!data) return null;
    return { userId: user.id, email: user.email!, marcaSlug: data.marca_slug };
  } catch {
    return null;
  }
}
