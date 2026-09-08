import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http",  hostname: "**" },
    ],
  },
  experimental: {
    // A importação de produtos envia as linhas para uma Server Action em lotes
    // (ver ImportWizard). Uma folga acima do padrão de 1 MB evita o 413 caso
    // um lote venha maior que o normal.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
