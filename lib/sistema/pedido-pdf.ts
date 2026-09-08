import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { phLogoDataUri } from "@/lib/sistema/ph-logo";
import PedidoPDF, { type PedidoPDFData } from "@/components/pdf/PedidoPDF";

/** Renderiza o PDF de um pedido em Buffer. `doc` vem de getPedidoDoc / getPedidoDocByToken. */
export async function renderPedidoPdf(doc: PedidoPDFData): Promise<Buffer> {
  doc.empresa.logo = await phLogoDataUri();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(PedidoPDF, { d: doc }) as any);
  return buffer as unknown as Buffer;
}
