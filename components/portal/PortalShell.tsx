"use client";

import { usePathname, useRouter } from "next/navigation";
import ClienteMenuLateral from "./ClienteMenuLateral";
import ClienteBottomNav from "./ClienteBottomNav";
import SinoNotificacoes from "@/components/shared/SinoNotificacoes";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const PUBLIC_PATHS = ["/portal/login", "/portal/registro", "/portal/recuperar-senha", "/portal/nova-senha"];

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isPublic) return <>{children}</>;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-dark-950">
      {/* Sidebar — apenas desktop */}
      <ClienteMenuLateral />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header mobile */}
        <header className="md:hidden flex-shrink-0 h-12 bg-dark-900 border-b border-white/8 flex items-center justify-between px-4 z-30">
          <Image src="/images/ph.png" alt="PH" width={80} height={24} className="object-contain h-6 w-auto" />
          <div className="flex items-center gap-2">
            <SinoNotificacoes />
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1"
            >
              Sair
            </button>
          </div>
        </header>

        {/* Conteúdo — padding-bottom para não sobrepor o bottom nav no mobile */}
        <main className="flex-1 overflow-auto min-w-0 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Bottom nav — apenas mobile */}
      <ClienteBottomNav />
    </div>
  );
}
