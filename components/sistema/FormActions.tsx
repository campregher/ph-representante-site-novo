"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";

export default function FormActions({
  submitLabel = "Salvar",
  loading = false,
  onCancel,
}: {
  submitLabel?: string;
  loading?: boolean;
  onCancel?: () => void;
}) {
  const router = useRouter();
  return (
    <div className="mt-6 flex items-center gap-2 border-t border-neutral-200 pt-4">
      <Button type="submit" loading={loading}>
        {submitLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => (onCancel ? onCancel() : router.back())}
        disabled={loading}
      >
        Cancelar
      </Button>
    </div>
  );
}
