import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portal do Cliente — PH Representante" };

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
