"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import SinoNotificacoes from "@/components/shared/SinoNotificacoes";

interface Props {
  title: string;
  actions?: React.ReactNode;
}

export default function MarcaContentHeader({ title, actions }: Props) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/marca/login");
    router.refresh();
  }

  return (
    <header className="bg-dark-900 border-b border-white/8 sticky top-0 z-20">
      <div className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        <h1 className="text-sm font-bold text-white">{title}</h1>
        <div className="flex items-center gap-1.5">
          {actions}
          {/* sino e logout apenas no desktop — no mobile ficam no header do shell */}
          <div className="hidden md:flex items-center gap-1">
            <SinoNotificacoes />
            <button
              onClick={handleLogout}
              title="Sair"
              className="flex items-center justify-center w-8 h-8 rounded-xl text-gray-500 hover:text-white hover:bg-white/8 transition-all"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
