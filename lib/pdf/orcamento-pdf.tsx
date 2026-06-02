import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: "#1a1a1a", backgroundColor: "#fff", padding: 40 },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: "1pt solid #e5e7eb" },
  brandName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#c0392b", letterSpacing: 1 },
  brandSub: { fontSize: 7, color: "#6b7280", marginTop: 2 },
  pedidoLabel: { fontSize: 7, color: "#9ca3af", textAlign: "right", textTransform: "uppercase", letterSpacing: 0.8 },
  pedidoNum: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#111", textAlign: "right" },
  pedidoMeta: { fontSize: 7, color: "#6b7280", textAlign: "right", marginTop: 2 },
  tipoBadge: { marginTop: 4, alignSelf: "flex-end", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tipoBadgeEstoque: { backgroundColor: "#f3f4f6", border: "0.5pt solid #d1d5db" },
  tipoBadgeDrop: { backgroundColor: "#eff6ff", border: "0.5pt solid #bfdbfe" },
  tipoBadgeText: { fontSize: 7, fontFamily: "Helvetica-Bold" },

  // Parties
  parties: { flexDirection: "row", borderBottom: "1pt solid #e5e7eb", marginBottom: 16 },
  partyCol: { flex: 1, padding: 14 },
  partyDivider: { width: "0.5pt", backgroundColor: "#e5e7eb" },
  partyLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  partyName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#111", marginBottom: 2 },
  partyRazao: { fontSize: 7.5, color: "#4b5563", marginBottom: 6 },
  partyDetail: { fontSize: 7.5, color: "#6b7280", marginBottom: 2 },

  // Intermediario note
  intermediario: { marginBottom: 14, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "#fafafa", borderRadius: 4, border: "0.5pt solid #f3f4f6" },
  intermediarioText: { fontSize: 7, color: "#9ca3af", textAlign: "center" },

  // Items
  sectionLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  tableHeader: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb", paddingBottom: 5, marginBottom: 2 },
  thProd: { flex: 1, fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6b7280" },
  thQtd: { width: 40, fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6b7280", textAlign: "center" },
  thUnit: { width: 72, fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6b7280", textAlign: "right" },
  thTotal: { width: 72, fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6b7280", textAlign: "right" },
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 5, borderBottom: "0.5pt solid #f3f4f6" },
  sku: { fontSize: 7, color: "#c0392b", fontFamily: "Helvetica-Bold" },
  prodName: { fontSize: 8, color: "#111", marginTop: 1 },
  tdQtd: { width: 40, fontSize: 8, color: "#374151", textAlign: "center", paddingTop: 1 },
  tdVal: { width: 72, fontSize: 8, color: "#374151", textAlign: "right", paddingTop: 1 },
  tdTotal: { width: 72, fontSize: 8, color: "#111", fontFamily: "Helvetica-Bold", textAlign: "right", paddingTop: 1 },

  // Footer
  footer: { marginTop: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  conditions: { flex: 1, marginRight: 20 },
  condLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  condItem: { fontSize: 8, color: "#374151", marginBottom: 3 },
  condObs: { fontSize: 7.5, color: "#6b7280", marginTop: 4, fontStyle: "italic" },
  totalBox: { alignItems: "flex-end", paddingLeft: 20, borderLeft: "1pt solid #e5e7eb" },
  totalLabel: { fontSize: 7, color: "#9ca3af", marginBottom: 4 },
  totalValue: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#111" },

  pageFooter: { marginTop: 24, paddingTop: 10, borderTop: "0.5pt solid #e5e7eb", flexDirection: "row", justifyContent: "space-between" },
  pageFooterText: { fontSize: 6.5, color: "#9ca3af" },
});

function fmt(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Item { produto_sku: string; produto_nome: string; quantidade: number; valor_unitario: number; valor_total: number }
interface Brand { name: string; razao_social?: string | null; cnpj?: string | null; email?: string | null; telefone?: string | null; contato?: string | null; logradouro?: string | null; numero?: string | null; bairro?: string | null; cidade?: string | null; estado?: string | null }
interface Cliente { razao_social: string; nome_fantasia?: string | null; cnpj: string; email: string; whatsapp: string; logradouro?: string | null; numero?: string | null; bairro?: string | null; cidade?: string | null; estado?: string | null }

export interface OrcamentoPDFProps {
  numero: number;
  dataBR: string;
  horaBR: string;
  tipoPedido: string;
  brand: Brand | null;
  cliente: Cliente | null;
  itens: Item[];
  condicao_pagamento: string | null;
  prazo_boleto?: string | null;
  transportadora?: string | null;
  observacoes?: string | null;
  total: number;
}

export function OrcamentoPDF({ numero, dataBR, horaBR, tipoPedido, brand, cliente, itens, condicao_pagamento, prazo_boleto, transportadora, observacoes, total }: OrcamentoPDFProps) {
  const isDrop = tipoPedido === "dropshipping";
  const endBrand = [brand?.logradouro && `${brand.logradouro}${brand.numero ? `, ${brand.numero}` : ""}`, brand?.bairro, brand?.cidade && brand?.estado ? `${brand.cidade}/${brand.estado}` : (brand?.cidade ?? brand?.estado)].filter(Boolean).join(" — ");
  const endCliente = [cliente?.logradouro && `${cliente.logradouro}${cliente?.numero ? `, ${cliente.numero}` : ""}`, cliente?.bairro, cliente?.cidade && cliente?.estado ? `${cliente.cidade}/${cliente.estado}` : (cliente?.cidade ?? cliente?.estado)].filter(Boolean).join(" — ");

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brandName}>PH REPRESENTANTE</Text>
            <Text style={s.brandSub}>Representação Comercial Automotiva</Text>
          </View>
          <View>
            <Text style={s.pedidoLabel}>Pedido</Text>
            <Text style={s.pedidoNum}>#{numero}</Text>
            <Text style={s.pedidoMeta}>{dataBR} · {horaBR}</Text>
            <View style={[s.tipoBadge, isDrop ? s.tipoBadgeDrop : s.tipoBadgeEstoque]}>
              <Text style={[s.tipoBadgeText, { color: isDrop ? "#2563eb" : "#374151" }]}>
                {isDrop ? "Dropshipping" : "Estoque"}
              </Text>
            </View>
          </View>
        </View>

        {/* Intermediário */}
        <View style={s.intermediario}>
          <Text style={s.intermediarioText}>Este pedido é intermediado pela PH Representante — Representação Comercial Automotiva</Text>
        </View>

        {/* Fornecedor | Cliente */}
        <View style={s.parties}>
          <View style={s.partyCol}>
            <Text style={s.partyLabel}>Fornecedor</Text>
            {brand ? (
              <>
                <Text style={s.partyName}>{brand.name}</Text>
                {brand.razao_social && <Text style={s.partyRazao}>{brand.razao_social}</Text>}
                {brand.cnpj && <Text style={s.partyDetail}>CNPJ: {brand.cnpj}</Text>}
                {brand.contato && <Text style={s.partyDetail}>Resp.: {brand.contato}</Text>}
                {brand.email && <Text style={s.partyDetail}>{brand.email}</Text>}
                {brand.telefone && <Text style={s.partyDetail}>{brand.telefone}</Text>}
                {endBrand ? <Text style={s.partyDetail}>{endBrand}</Text> : null}
              </>
            ) : (
              <Text style={s.partyDetail}>—</Text>
            )}
          </View>
          <View style={s.partyDivider} />
          <View style={s.partyCol}>
            <Text style={s.partyLabel}>Comprador</Text>
            {cliente ? (
              <>
                <Text style={s.partyName}>{cliente.razao_social}</Text>
                {cliente.nome_fantasia && <Text style={s.partyRazao}>{cliente.nome_fantasia}</Text>}
                <Text style={s.partyDetail}>CNPJ: {cliente.cnpj}</Text>
                <Text style={s.partyDetail}>{cliente.email}</Text>
                <Text style={s.partyDetail}>{cliente.whatsapp}</Text>
                {endCliente ? <Text style={s.partyDetail}>{endCliente}</Text> : null}
              </>
            ) : (
              <Text style={s.partyDetail}>—</Text>
            )}
          </View>
        </View>

        {/* Itens */}
        <View style={{ marginBottom: 20 }}>
          <Text style={s.sectionLabel}>Itens do pedido</Text>
          <View style={s.tableHeader}>
            <Text style={s.thProd}>Produto</Text>
            <Text style={s.thQtd}>Qtd</Text>
            <Text style={s.thUnit}>Valor unit.</Text>
            <Text style={s.thTotal}>Total</Text>
          </View>
          {itens.map((item, i) => (
            <View key={i} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.sku}>{item.produto_sku}</Text>
                <Text style={s.prodName}>{item.produto_nome}</Text>
              </View>
              <Text style={s.tdQtd}>{item.quantidade}</Text>
              <Text style={s.tdVal}>{Number(item.valor_unitario) > 0 ? fmt(Number(item.valor_unitario)) : "—"}</Text>
              <Text style={s.tdTotal}>{Number(item.valor_total) > 0 ? fmt(Number(item.valor_total)) : "—"}</Text>
            </View>
          ))}
        </View>

        {/* Condições + Total */}
        <View style={s.footer}>
          <View style={s.conditions}>
            <Text style={s.condLabel}>Condições</Text>
            {condicao_pagamento && (
              <Text style={s.condItem}>
                Pagamento: {condicao_pagamento === "pix" ? "PIX" : `Boleto${prazo_boleto ? ` — ${prazo_boleto} dias` : ""}`}
              </Text>
            )}
            {transportadora && <Text style={s.condItem}>Transportadora: {transportadora}</Text>}
            {observacoes && <Text style={s.condObs}>Obs: {observacoes}</Text>}
          </View>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>Total geral</Text>
            <Text style={s.totalValue}>{total > 0 ? fmt(total) : "A definir"}</Text>
          </View>
        </View>

        {/* Page footer */}
        <View style={s.pageFooter}>
          <Text style={s.pageFooterText}>PH Representante — Intermediário Comercial Automotivo</Text>
          <Text style={s.pageFooterText}>Pedido #{numero}</Text>
        </View>
      </Page>
    </Document>
  );
}
