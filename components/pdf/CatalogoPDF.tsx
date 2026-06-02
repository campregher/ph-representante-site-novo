import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image as PdfImage,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { Product } from "@/lib/produtos";
import { brands } from "@/lib/brands";

Font.registerHyphenationCallback((word) => [word]);

const RED = "#e11d48";
const DARK = "#0f172a";
const GRAY = "#64748b";
const LIGHT = "#f1f5f9";
const BORDER = "#e2e8f0";

const s = StyleSheet.create({
  coverPage: { backgroundColor: DARK, padding: 0 },
  coverInner: { flex: 1, justifyContent: "center", alignItems: "center", padding: 60 },
  coverAccent: { width: 56, height: 3, backgroundColor: RED, marginBottom: 32 },
  coverTitle: { fontSize: 34, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "center", marginBottom: 10 },
  coverSub: { fontSize: 13, color: "#94a3b8", textAlign: "center", marginBottom: 8 },
  coverBrand: { fontSize: 11, color: RED, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 4 },
  coverDate: { position: "absolute", bottom: 40, fontSize: 9, color: "#475569" },
  coverContact: { position: "absolute", bottom: 24, fontSize: 8, color: "#334155" },

  page: { backgroundColor: "#ffffff", paddingHorizontal: 36, paddingTop: 36, paddingBottom: 48, fontFamily: "Helvetica", fontSize: 9, color: "#1e293b" },

  pageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: RED },
  pageHeaderTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK },
  pageHeaderRight: { fontSize: 8, color: GRAY },

  brandSection: { marginBottom: 20 },
  brandTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 10, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  brandTag: { fontSize: 8, color: GRAY, marginBottom: 10 },

  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  card: { width: "31%", backgroundColor: LIGHT, borderRadius: 4, padding: 7, borderWidth: 1, borderColor: BORDER },
  cardEmpty: { width: "31%", backgroundColor: "transparent" },
  imgBox: { width: "100%", height: 72, backgroundColor: "#ffffff", borderRadius: 3, marginBottom: 6, alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: 72, objectFit: "contain" },
  sku: { fontSize: 6.5, color: RED, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  name: { fontSize: 7.5, color: DARK, lineHeight: 1.3 },

  footer: { position: "absolute", bottom: 16, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#94a3b8" },
  pageNum: { fontSize: 7, color: "#94a3b8" },
});

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function ProductCard({ product }: { product: Product }) {
  return (
    <View style={s.card}>
      <View style={s.imgBox}>
        {product.images[0] ? (
          <PdfImage src={{ uri: product.images[0], method: "GET", headers: {}, body: "" }} style={s.img} />
        ) : (
          <Text style={{ fontSize: 7, color: "#cbd5e1" }}>Sem imagem</Text>
        )}
      </View>
      <Text style={s.sku}>{product.sku}</Text>
      <Text style={s.name}>{product.name}</Text>
    </View>
  );
}

interface Props {
  products: Product[];
  brandSlug?: string;
  generatedAt: string;
}

export default function CatalogoPDF({ products, brandSlug, generatedAt }: Props) {
  const brandInfo = brandSlug ? brands.find((b) => b.slug === brandSlug) : null;

  const grouped: { brand: typeof brands[0] | undefined; slug: string; items: Product[] }[] = [];
  if (brandSlug) {
    grouped.push({ brand: brandInfo ?? undefined, slug: brandSlug, items: products });
  } else {
    for (const brand of brands) {
      const items = products.filter((p) => p.brand === brand.slug);
      if (items.length > 0) grouped.push({ brand, slug: brand.slug, items });
    }
    const otherSlug = brands.map((b) => b.slug);
    const others = products.filter((p) => !otherSlug.includes(p.brand));
    if (others.length > 0) grouped.push({ brand: undefined, slug: "outros", items: others });
  }

  return (
    <Document title={brandInfo ? `Catálogo ${brandInfo.name} — PH Representante` : "Catálogo PH Representante"} author="PH Representante">
      {/* Cover */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverInner}>
          <View style={s.coverAccent} />
          <Text style={s.coverTitle}>PH REPRESENTANTE</Text>
          <Text style={s.coverSub}>CATÁLOGO DE PRODUTOS{"\n"}{products.length} produto{products.length !== 1 ? "s" : ""}</Text>
          {brandInfo && <Text style={s.coverBrand}>{brandInfo.name} · {brandInfo.segment}</Text>}
        </View>
        <Text style={s.coverDate}>Gerado em {generatedAt}</Text>
        <Text style={s.coverContact}>phrepresentante.com.br  |  WhatsApp: (11) 95999-3968</Text>
      </Page>

      {/* Products pages */}
      {grouped.map(({ brand, slug, items }) => {
        const rows = chunk(items, 3);
        return (
          <Page key={slug} size="A4" style={s.page}>
            <View style={s.pageHeader}>
              <Text style={s.pageHeaderTitle}>PH REPRESENTANTE — {brand?.name ?? slug.toUpperCase()}</Text>
              <Text style={s.pageHeaderRight}>{brand?.segment ?? ""}</Text>
            </View>

            <View style={s.brandSection}>
              {rows.map((row, ri) => (
                <View key={ri} style={s.row}>
                  {row.map((p) => <ProductCard key={p.id} product={p} />)}
                  {row.length === 2 && <View style={s.cardEmpty} />}
                  {row.length === 1 && <><View style={s.cardEmpty} /><View style={s.cardEmpty} /></>}
                </View>
              ))}
            </View>

            <View style={s.footer} fixed>
              <Text>PH Representante · phrepresentante.com.br</Text>
              <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
