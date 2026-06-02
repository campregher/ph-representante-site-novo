"use client";

import { usePathname } from "next/navigation";
import ClienteMenuLateral from "./ClienteMenuLateral";

const PUBLIC_PATHS = ["/portal/login", "/portal/registro", "/portal/recuperar-senha", "/portal/nova-senha"];

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isPublic) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-dark-950">
      <ClienteMenuLateral />
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
