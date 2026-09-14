import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMinhasNotificacoes } from "@/lib/sistema/notificacoes";
import AppShell from "@/components/sistema/AppShell";
import AccessDenied from "@/components/sistema/AccessDenied";
import { getAuthedUserAndProfile, type Role } from "@/lib/sistema/auth";

export const metadata: Metadata = {
  title: "Sistema Comercial | PH Representante",
  robots: { index: false, follow: false },
};

export default async function SistemaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // dispara junto com a checagem de sessão/profile (economiza mais uma viagem
  // sequencial); no caso raro de sessão inválida/perfil inativo, a busca é
  // só descartada abaixo.
  const [{ user, profile }, notificacoes] = await Promise.all([
    getAuthedUserAndProfile(),
    getMinhasNotificacoes(),
  ]);

  if (!user) redirect("/login?redirect=/sistema");

  if (!profile || !profile.ativo) {
    return (
      <div data-sistema className="min-h-screen bg-neutral-50 text-neutral-900">
        <AccessDenied email={user.email ?? ""} />
      </div>
    );
  }

  return (
    <div data-sistema className="min-h-screen bg-neutral-50 text-neutral-900">
      <AppShell
        profile={{
          nome: profile.nome,
          email: profile.email,
          role: profile.role as Role,
        }}
        notificacoes={notificacoes}
      >
        {children}
      </AppShell>
    </div>
  );
}
