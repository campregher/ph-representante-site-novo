import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PH Representante - Acessórios Automotivos no Atacado e Dropshipping";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#08090b",
          color: "#ffffff",
          fontFamily: "Arial",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              width: "82px",
              height: "82px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "20px",
              background: "#dc2626",
              fontSize: "34px",
              fontWeight: 900,
            }}
          >
            PH
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "34px", fontWeight: 900 }}>PH Representante</div>
            <div style={{ fontSize: "24px", color: "#d1d5db" }}>Representação Comercial Automotiva</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div
            style={{
              maxWidth: "920px",
              fontSize: "70px",
              lineHeight: 1.02,
              fontWeight: 900,
              letterSpacing: 0,
            }}
          >
            Acessórios automotivos para atacado e dropshipping
          </div>
          <div style={{ maxWidth: "820px", fontSize: "30px", lineHeight: 1.35, color: "#d1d5db" }}>
            Fornecimento, suporte comercial e gestão para sellers de Mercado Livre e Shopee em todo o Brasil.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            fontSize: "24px",
            color: "#ffffff",
          }}
        >
          <span style={{ padding: "12px 18px", borderRadius: "999px", background: "#1f2937" }}>Atacado</span>
          <span style={{ padding: "12px 18px", borderRadius: "999px", background: "#dc2626" }}>Dropshipping</span>
          <span style={{ padding: "12px 18px", borderRadius: "999px", background: "#1f2937" }}>Marketplaces</span>
        </div>
      </div>
    ),
    size,
  );
}
