import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSistemaClient } from "@/lib/supabase/server";
import AppShell from "@/components/sistema/AppShell";
import AccessDenied from "@/components/sistema/AccessDenied";
import type { Role } from "@/lib/sistema/auth";

export const metadata: Metadata = {
  title: "Sistema Comercial | PH Representante",
  robots: { index: false, follow: false },
};

export default async function SistemaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSistemaClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/sistema");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome, email, telefone, avatar_url, role, ativo")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div data-sistema className="min-h-screen bg-neutral-50 text-neutral-900">
      {!profile || !profile.ativo ? (
        <AccessDenied email={user.email ?? ""} />
      ) : (
        <AppShell
          profile={{
            nome: profile.nome,
            email: profile.email,
            role: profile.role as Role,
          }}
        >
          {children}
        </AppShell>
      )}
    </div>
  );
}
