import type { Metadata } from "next";
import CatalogoClient from "./CatalogoClient";

const title = "Catálogo de acessórios automotivos | PH Representante";
const description = "Conheça as marcas representadas pela PH e consulte acessórios automotivos para atacado e dropshipping. Explore produtos, categorias e catálogos por marca.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/catalogo" },
  openGraph: { title, description, url: "/catalogo" },
  twitter: { card: "summary_large_image", title, description },
};

export default function CatalogoPage() {
  return <CatalogoClient />;
}
