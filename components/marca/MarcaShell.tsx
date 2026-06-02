"use client";

import { usePathname } from "next/navigation";
import MarcaMenuLateral from "./MarcaMenuLateral";

const PUBLIC_PATHS = ["/marca/login", "/marca/recuperar-senha", "/marca/nova-senha"];

interface Props {
  children: React.ReactNode;
  marcaSlug: string;
  marcaNome: string;
  marcaLogo?: string | null;
}

export default function MarcaShell({ children, marcaSlug, marcaNome, marcaLogo }: Props) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isPublic) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-dark-950">
      <MarcaMenuLateral marcaSlug={marcaSlug} marcaNome={marcaNome} marcaLogo={marcaLogo} />
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
