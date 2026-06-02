import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { getProducts } from "@/lib/produtos";
import CatalogoPDF from "@/components/pdf/CatalogoPDF";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const marca = searchParams.get("marca") ?? undefined;

    const products = await getProducts({ brand: marca, activeOnly: true });

    const generatedAt = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(CatalogoPDF, { products, brandSlug: marca, generatedAt }) as any
    );

    const filename = marca ? `catalogo-${marca}.pdf` : "catalogo-ph-representante.pdf";

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
