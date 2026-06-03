"use client";

import { usePathname, useRouter } from "next/navigation";
import MarcaMenuLateral from "./MarcaMenuLateral";
import MarcaBottomNav from "./MarcaBottomNav";
import SinoNotificacoes from "@/components/shared/SinoNotificacoes";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const PUBLIC_PATHS = ["/marca/login", "/marca/recuperar-senha", "/marca/nova-senha"];

interface Props {
  children: React.ReactNode;
  marcaSlug: string;
  marcaNome: string;
  marcaLogo?: string | null;
}

export default function MarcaShell({ children, marcaSlug, marcaNome, marcaLogo }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isPublic) return <>{children}</>;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/marca/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-dark-950">
      {/* Sidebar — apenas desktop */}
      <MarcaMenuLateral marcaSlug={marcaSlug} marcaNome={marcaNome} marcaLogo={marcaLogo} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header mobile */}
        <header className="md:hidden flex-shrink-0 h-12 bg-dark-900 border-b border-white/8 flex items-center justify-between px-4 z-30">
          <div className="flex items-center gap-2 min-w-0">
            {marcaLogo ? (
              <Image src={marcaLogo} alt={marcaNome} width={80} height={24} className="object-contain h-6 w-auto" />
            ) : (
              <span className="text-sm font-bold text-white truncate max-w-[140px]">{marcaNome}</span>
            )}
          </div>
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
      <MarcaBottomNav />
    </div>
  );
}
