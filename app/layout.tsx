import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal"],
  display: "swap",
});
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  display: "swap",
});

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
  icons: {
    icon: [
      { url: "/images/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/images/favicon.png",
    apple: "/images/favicon.png",
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

];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`h-full antialiased ${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-full flex flex-col bg-dark-900 text-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
        <Toaster
          theme="dark"
          richColors
          position="top-right"
          closeButton
          toastOptions={{ duration: 4500 }}
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-8D8YLGH1SG"
          strategy="afterInteractive"
        />
        <Script id="google-analytics-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-8D8YLGH1SG');
            ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ""}
          `}
        </Script>
      </body>
    </html>
  );
}
