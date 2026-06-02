import type { Metadata } from "next";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";
import MarcaShell from "@/components/marca/MarcaShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel da Marca — PH Representante" };

export default async function MarcaLayout({ children }: { children: React.ReactNode }) {
  const marcaUser = await getMarcaUser();

  let marcaNome  = "";
  let marcaLogo: string | null = null;
  let marcaSlug  = marcaUser?.marcaSlug ?? "";

  if (marcaUser?.marcaSlug) {
    const admin = await createAdminClient();
    const { data } = await admin
      .from("marcas")
      .select("name, logo_url")
      .eq("slug", marcaUser.marcaSlug)
      .single();
    marcaNome = data?.name ?? marcaUser.marcaSlug;
    marcaLogo = data?.logo_url ?? null;
  }

  return (
    <MarcaShell marcaSlug={marcaSlug} marcaNome={marcaNome} marcaLogo={marcaLogo}>
      {children}
    </MarcaShell>
  );
}
