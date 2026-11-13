import { redirect } from "next/navigation";
import { requireSeller } from "@/lib/sistema/seller-auth";
import AuthCard from "@/components/sistema/AuthCard";
import OnboardingFlow from "@/components/drop/OnboardingFlow";

export default async function OnboardingPage() {
  const seller = await requireSeller();
  if (!seller.liberado) redirect("/drop/dashboard");
  if (seller.onboardingCompleto) redirect("/drop/dashboard");

  return (
    <AuthCard visual maxWidthClassName="max-w-xl">
      <OnboardingFlow portalToken={seller.portalToken} />
    </AuthCard>
  );
}
