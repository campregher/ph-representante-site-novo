import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PH Representante | Acessórios Automotivos | Atacado e Dropshipping",
  description:
    "Representação comercial de acessórios automotivos para distribuidores, lojistas e sellers de Mercado Livre e Shopee. Atacado, dropshipping e gestão de marketplaces.",
  keywords: [
    "acessórios automotivos",
    "atacado automotivo",
    "dropshipping automotivo",
    "representação comercial",
    "seller mercado livre",
    "seller shopee",
    "gestão marketplace",
    "tapetes automotivos",
    "calhas de chuva",
    "frisos automotivos",
  ],
  authors: [{ name: "PH Representante" }],
  creator: "PH Representante",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "PH Representante | Acessórios Automotivos",
    description:
      "Seu parceiro em acessórios automotivos para atacado e dropshipping. Atendemos distribuidores, lojistas e sellers em todo Brasil.",
    siteName: "PH Representante",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "PH Representante - Acessórios Automotivos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PH Representante | Acessórios Automotivos",
    description:
      "Representação comercial de acessórios automotivos. Atacado, dropshipping e gestão de marketplaces.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://phrepresentante.com.br",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-dark-900 text-white">
        {children}
      </body>
    </html>
  );
}
