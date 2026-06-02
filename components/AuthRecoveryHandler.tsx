"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

// Handles the case where Supabase redirects the recovery link to the root (/)
// instead of /marca/nova-senha or /portal/nova-senha (happens when NEXT_PUBLIC_SITE_URL
// isn't configured or the URL isn't in Supabase's allowed redirect list).
export default function AuthRecoveryHandler() {
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname.includes("nova-senha")) return; // Already on the right page

    const hash   = window.location.hash.slice(1);
    if (!hash) return;

    const params      = new URLSearchParams(hash);
    const type        = params.get("type");
    const accessToken = params.get("access_token");

    if (type !== "recovery" || !accessToken) return;

    // Determine if this is a marca or portal user by checking the token
    fetch("/api/auth/user-type", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ access_token: accessToken }),
    })
      .then((r) => r.json())
      .then(({ type: userType }) => {
        const dest = userType === "marca" ? "/marca/nova-senha" : "/portal/nova-senha";
        router.replace(dest + window.location.hash);
      })
      .catch(() => {
        router.replace("/marca/nova-senha" + window.location.hash);
      });
  }, [pathname, router]);

  return null;
}
