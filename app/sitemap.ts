import type { MetadataRoute } from "next";
import { brands } from "@/lib/brands";

const siteUrl = "https://phrepresentante.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/catalogo`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...brands.map((brand) => ({
      url: `${siteUrl}/catalogo/${brand.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
