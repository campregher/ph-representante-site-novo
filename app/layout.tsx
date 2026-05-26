import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const GOOGLE_ADS_ID = "AW-18096631778";

const siteUrl = "https://phrepresentante.com.br";
const title = "PH Representante | Acessórios Automotivos no Atacado e Dropshipping";
const description =
  "Representação comercial de acessórios automotivos para distribuidores, lojistas e sellers de Mercado Livre e Shopee. Atacado, dropshipping e gestão de marketplaces.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
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
  publisher: "PH Representante",
  applicationName: "PH Representante",
  category: "Representação comercial automotiva",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    title,
    description,
    siteName: "PH Representante",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "PH Representante - Acessórios Automotivos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl,
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#localbusiness`,
    name: "PH Representante",
    url: siteUrl,
    image: `${siteUrl}/opengraph-image`,
    logo: `${siteUrl}/images/ph.png`,
    email: "contato@phrepresentante.com.br",
    telephone: "+55 11 5999-3968",
    address: {
      "@type": "PostalAddress",
      addressLocality: "São Paulo",
      addressRegion: "SP",
      addressCountry: "BR",
    },
    areaServed: {
      "@type": "Country",
      name: "Brasil",
    },
    description,
    sameAs: [
      "https://instagram.com/phrepresentante",
      "https://facebook.com/phrepresentante",
    ],
    makesOffer: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Atacado de acessórios automotivos",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Dropshipping automotivo",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Gestão de Mercado Livre e Shopee",
        },
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: "PH Representante",
    url: siteUrl,
    inLanguage: "pt-BR",
    publisher: {
      "@id": `${siteUrl}/#localbusiness`,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Como funciona o dropshipping automotivo?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Você anuncia os produtos da PH no Mercado Livre ou Shopee com sua margem. Quando o cliente compra, você repassa o pedido para a PH e o produto é enviado diretamente ao consumidor.",
        },
      },
      {
        "@type": "Question",
        name: "Preciso ter estoque para trabalhar com a PH Representante?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No dropshipping não é necessário ter estoque. No atacado, o cliente compra em volume e mantém o próprio estoque.",
        },
      },
      {
        "@type": "Question",
        name: "A PH Representante atende todo o Brasil?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim. A PH Representante atende distribuidores, lojistas e sellers de todo o Brasil.",
        },
      },
      {
        "@type": "Question",
        name: "A PH faz gestão de conta no Mercado Livre e Shopee?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim. A PH oferece criação de anúncios, SEO para marketplace, gestão de ads, análise de métricas e consultoria estratégica para sellers.",
        },
      },
    ],
  },
];

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-ads-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
