import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrandBySlug } from "@/lib/brands";
import BrandClient from "./BrandClient";

type Props = { params: Promise<{ brand: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();

  const title = `Catálogo ${brand.name} | PH Representante`;
  const description = `Conheça os produtos ${brand.name} na PH Representante. Consulte o catálogo de ${brand.segment.toLocaleLowerCase("pt-BR")} e fale com nossa equipe sobre condições comerciais.`;
  const url = `/catalogo/${brand.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BrandPage({ params }: Props) {
  const { brand } = await params;
  if (!getBrandBySlug(brand)) notFound();
  return <BrandClient params={params} />;
}
