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

Font.registerHyphenationCallback((word) => [word]);

const RED = "#dc2626";
const DARK = "#232323";
const GRAY = "#6b7280";
const BORDER = "#e5e7eb";
const LIGHT = "#f3f4f6";

const s = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 40,
    paddingTop: 36,
    paddingBottom: 56,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1f2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: RED,
    paddingBottom: 10,
    marginBottom: 10,
  },
  logoWrap: { width: "45%" },
  logoWrapRight: { width: "45%", alignItems: "flex-end" },
  logo: { maxWidth: 170, maxHeight: 46, objectFit: "contain" },
  brand: { fontSize: 15, fontFamily: "Helvetica-Bold", color: DARK },
  brandRight: { fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK, textAlign: "right" },
  brandSub: { fontSize: 7.5, color: GRAY, marginTop: 3 },

  pedidoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pedidoNum: { fontSize: 14, fontFamily: "Helvetica-Bold", color: RED },
  pedidoMeta: { fontSize: 8.5, color: GRAY },

  cols: { flexDirection: "row", gap: 12, marginBottom: 12 },
  box: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 4, padding: 8 },
  boxTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: RED,
    textTransform: "uppercase",
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  line: { fontSize: 8.5, marginBottom: 2, lineHeight: 1.4 },
  label: { color: GRAY },

  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, marginBottom: 12 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER },
  trHead: { backgroundColor: LIGHT },
  th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: DARK, padding: 5 },
  td: { fontSize: 8, padding: 5, color: "#374151" },
  cCod: { width: "15%" },
  cProd: { width: "30%" },
  cQtd: { width: "8%", textAlign: "right" },
  cPreco: { width: "12%", textAlign: "right" },
  cDesc: { width: "8%", textAlign: "right" },
  cUnit: { width: "13%", textAlign: "right" },
  cTot: { width: "14%", textAlign: "right" },

  totals: { flexDirection: "row", justifyContent: "flex-end" },
  totalsBox: { width: "45%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalLabel: { fontSize: 9, color: GRAY },
  totalValue: { fontSize: 9 },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: DARK,
    marginTop: 3,
    paddingTop: 4,
  },
  grandLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK },
  grandValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: RED },

  obs: { marginTop: 14, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8 },
  obsTitle: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: GRAY, marginBottom: 3 },

  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#9ca3af",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
});

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const pct = (n: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(n) || 0)}%`;

export interface PedidoPDFData {
  numero: number;
  data: string;
  statusLabel: string;
  empresa: { nome: string; contato: string; logo?: string | null };
  representada: { nome: string; cnpj?: string | null; logo?: string | null };
  cliente: {
    nome: string;
    razao?: string | null;
    documento?: string | null;
    inscricaoEstadual?: string | null;
    endereco?: string | null;
    bairro?: string | null;
    cidadeUf?: string | null;
    cep?: string | null;
    telefone?: string | null;
    email?: string | null;
  };
  tabela?: string | null;
  vendedor?: string | null;
  condicao_pagamento?: string | null;
  forma_pagamento?: string | null;
  previsao_entrega?: string | null;
  itens: {
    sku: string;
    descricao: string;
    qtd: number;
    preco: number;
    descPct: number;
    precoFinal: number;
    total: number;
  }[];
  subtotal: number;
  descontoPct: number;
  descontoValor: number;
  total: number;
  observacaoCliente?: string | null;
}

/** react-pdf não renderiza SVG via <Image> — só usa PNG/JPG/WEBP/data-uri. */
function usableImg(src?: string | null): string | null {
  if (!src) return null;
  if (/\.svg(\?|$)/i.test(src)) return null;
  return src;
}

export default function PedidoPDF({ d }: { d: PedidoPDFData }) {
  const empLogo = usableImg(d.empresa.logo);
  const repLogo = usableImg(d.representada.logo);
  return (
    <Document title={`Pedido ${d.numero} — ${d.empresa.nome}`} author={d.empresa.nome}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.logoWrap}>
            {empLogo ? (
              <PdfImage src={empLogo} style={s.logo} />
            ) : (
              <Text style={s.brand}>{d.empresa.nome}</Text>
            )}
            <Text style={s.brandSub}>{d.empresa.contato}</Text>
          </View>
          <View style={s.logoWrapRight}>
            {repLogo ? (
              <PdfImage src={repLogo} style={s.logo} />
            ) : (
              <Text style={s.brandRight}>{d.representada.nome}</Text>
            )}
          </View>
        </View>

        <View style={s.pedidoBar}>
          <Text style={s.pedidoNum}>PEDIDO #{d.numero}</Text>
          <Text style={s.pedidoMeta}>
            {d.representada.nome}  ·  {d.data}  ·  {d.statusLabel}
          </Text>
        </View>

        <View style={s.cols}>
          <View style={s.box}>
            <Text style={s.boxTitle}>Cliente</Text>
            <Text style={[s.line, { fontFamily: "Helvetica-Bold" }]}>{d.cliente.nome}</Text>
            {d.cliente.razao ? <Text style={s.line}>{d.cliente.razao}</Text> : null}
            {d.cliente.documento ? (
              <Text style={s.line}>
                <Text style={s.label}>CNPJ/CPF: </Text>
                {d.cliente.documento}
              </Text>
            ) : null}
            {d.cliente.inscricaoEstadual ? (
              <Text style={s.line}>
                <Text style={s.label}>IE: </Text>
                {d.cliente.inscricaoEstadual}
              </Text>
            ) : null}
            {d.cliente.endereco ? <Text style={s.line}>{d.cliente.endereco}</Text> : null}
            {d.cliente.bairro || d.cliente.cidadeUf || d.cliente.cep ? (
              <Text style={s.line}>
                {[d.cliente.bairro, d.cliente.cidadeUf, d.cliente.cep && `CEP ${d.cliente.cep}`]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
            {d.cliente.telefone ? (
              <Text style={s.line}>
                <Text style={s.label}>Tel: </Text>
                {d.cliente.telefone}
              </Text>
            ) : null}
            {d.cliente.email ? (
              <Text style={s.line}>
                <Text style={s.label}>E-mail: </Text>
                {d.cliente.email}
              </Text>
            ) : null}
          </View>
          <View style={s.box}>
            <Text style={s.boxTitle}>Condições</Text>
            {d.tabela ? (
              <Text style={s.line}>
                <Text style={s.label}>Tabela: </Text>
                {d.tabela}
              </Text>
            ) : null}
            {d.vendedor ? (
              <Text style={s.line}>
                <Text style={s.label}>Vendedor: </Text>
                {d.vendedor}
              </Text>
            ) : null}
            {d.condicao_pagamento ? (
              <Text style={s.line}>
                <Text style={s.label}>Pagamento: </Text>
                {d.condicao_pagamento}
              </Text>
            ) : null}
            {d.forma_pagamento ? (
              <Text style={s.line}>
                <Text style={s.label}>Forma: </Text>
                {d.forma_pagamento}
              </Text>
            ) : null}
            {d.previsao_entrega ? (
              <Text style={s.line}>
                <Text style={s.label}>Previsão de entrega: </Text>
                {d.previsao_entrega}
              </Text>
            ) : null}
            {d.representada.cnpj ? (
              <Text style={s.line}>
                <Text style={s.label}>CNPJ representada: </Text>
                {d.representada.cnpj}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={s.table}>
          <View style={[s.tr, s.trHead]}>
            <Text style={[s.th, s.cCod]}>Código</Text>
            <Text style={[s.th, s.cProd]}>Produto</Text>
            <Text style={[s.th, s.cQtd]}>Qtd</Text>
            <Text style={[s.th, s.cPreco]}>Preço</Text>
            <Text style={[s.th, s.cDesc]}>Desc.</Text>
            <Text style={[s.th, s.cUnit]}>Unit. líq.</Text>
            <Text style={[s.th, s.cTot]}>Total</Text>
          </View>
          {d.itens.map((it, i) => (
            <View key={i} style={s.tr} wrap={false}>
              <Text style={[s.td, s.cCod]}>{it.sku}</Text>
              <Text style={[s.td, s.cProd]}>{it.descricao}</Text>
              <Text style={[s.td, s.cQtd]}>{it.qtd}</Text>
              <Text style={[s.td, s.cPreco]}>{brl(it.preco)}</Text>
              <Text style={[s.td, s.cDesc]}>{it.descPct > 0 ? pct(it.descPct) : "—"}</Text>
              <Text style={[s.td, s.cUnit]}>{brl(it.precoFinal)}</Text>
              <Text style={[s.td, s.cTot]}>{brl(it.total)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{brl(d.subtotal)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Desconto adicional ({pct(d.descontoPct)})</Text>
              <Text style={s.totalValue}>- {brl(d.descontoValor)}</Text>
            </View>
            <View style={s.grand}>
              <Text style={s.grandLabel}>TOTAL</Text>
              <Text style={s.grandValue}>{brl(d.total)}</Text>
            </View>
          </View>
        </View>

        {d.observacaoCliente ? (
          <View style={s.obs}>
            <Text style={s.obsTitle}>OBSERVAÇÕES</Text>
            <Text style={{ fontSize: 8.5, lineHeight: 1.4 }}>{d.observacaoCliente}</Text>
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text>{d.empresa.nome} · {d.empresa.contato}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
