import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seja um seller | PH Representante",
  robots: { index: false, follow: false },
};

export default function DropLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
