"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton({
  variant = "icon",
}: {
  variant?: "icon" | "plain";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await createClient().auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (variant === "plain") {
    return (
      <button
        onClick={signOut}
        disabled={loading}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        <LogOut size={15} /> Sair
      </button>
    );
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      title="Sair"
      aria-label="Sair"
      className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
    >
      <LogOut size={17} />
    </button>
  );
}
