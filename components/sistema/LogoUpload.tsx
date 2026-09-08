"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui/Button";

const BUCKET = "sistema-comercial";
const MAX_BYTES = 2 * 1024 * 1024;

export default function LogoUpload({
  value,
  onChange,
  folder = "logos",
}: {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handle(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Imagem acima de 2 MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) {
        const msg = /row-level security|not found|bucket/i.test(error.message)
          ? "Storage não configurado. Rode a migration 016 (bucket sistema-comercial) no Supabase."
          : error.message;
        toast.error(msg);
        return;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Imagem enviada.");
    } catch {
      toast.error("Falha no upload.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {value ? (
          <Image
            src={value}
            alt=""
            width={64}
            height={64}
            className="h-full w-full object-contain p-1"
            unoptimized
          />
        ) : (
          <span className="text-[10px] text-neutral-400">sem logo</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={14} /> Enviar imagem
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <X size={14} /> Remover
            </Button>
          )}
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ou cole uma URL de imagem"
          className="w-72 max-w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-600 focus:border-brand/40 focus:outline-none"
        />
        <p className="text-[11px] text-neutral-400">PNG, JPG, WEBP ou SVG · até 2 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
