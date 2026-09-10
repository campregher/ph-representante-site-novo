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
const BORDER = "#d1d5db";
const HAIR = "#e5e7eb";
const HEAD = "#f3f4f6";
const ZEBRA = "#fafafa";

const s = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 34,
    paddingTop: 30,
    paddingBottom: 46,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1f2937",
  },

  /* Cabeçalho: logo PH | nome empresa + nº pedido | logo representada */
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: RED,
    paddingBottom: 12,
  },
  hLeft: { width: "30%" },
  hCenter: { width: "40%", alignItems: "center" },
  hRight: { width: "30%", alignItems: "flex-end" },
  logo: { maxWidth: 150, maxHeight: 46, objectFit: "contain" },
  empNome: { fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK, textAlign: "center" },
  empContato: { fontSize: 8, color: GRAY, marginTop: 3 },
  pedidoNum: { fontSize: 12, fontFamily: "Helvetica-Bold", color: RED, marginTop: 5 },
  repNome: { fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK, textAlign: "right" },

  /* Faixa da representada */
  band: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 7,
  },
  bandKey: { fontSize: 9, fontFamily: "Helvetica-Bold", color: DARK },
  bandVal: { fontSize: 9, color: "#374151" },

  /* Bloco do cliente — duas colunas de campos */
  cliente: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 9,
  },
  cliCol: { width: "50%", paddingRight: 14 },
  field: { flexDirection: "row", marginBottom: 3, lineHeight: 1.4 },
  fKey: { fontSize: 9, fontFamily: "Helvetica-Bold", color: DARK },
  fVal: { fontSize: 9, color: "#374151", flex: 1 },

  /* Tabela de itens */
  table: { marginTop: 14, borderWidth: 1, borderColor: BORDER },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: HAIR },
  trHead: { backgroundColor: HEAD, borderBottomWidth: 1, borderBottomColor: BORDER },
  trZebra: { backgroundColor: ZEBRA },
  trLast: { borderBottomWidth: 0 },
  th: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    paddingVertical: 8,
    paddingHorizontal: 7,
  },
  td: { fontSize: 9.5, paddingVertical: 9, paddingHorizontal: 7, color: "#374151" },
  tdStrong: { fontFamily: "Helvetica-Bold", color: DARK },
  tdDescCell: { paddingVertical: 9, paddingHorizontal: 7, alignItems: "flex-end" },
  tdDescMain: { fontSize: 9.5, color: "#374151" },
  tdMini: { fontSize: 7, color: GRAY, marginTop: 1 },

  cNum: { width: "4%", textAlign: "right" },
  cCod: { width: "11%" },
  cProd: { width: "35%" },
  cQtd: { width: "7%", textAlign: "right" },
  cPreco: { width: "12%", textAlign: "right" },
  cDesc: { width: "9%", textAlign: "right" },
  cLiq: { width: "11%", textAlign: "right" },
  cSub: { width: "11%", textAlign: "right" },

  /* Linha "Valor total" ancorada à tabela */
  totalStripe: {
    flexDirection: "row",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: BORDER,
    backgroundColor: HEAD,
  },
  totalStripeLabel: {
    width: "78%",
    textAlign: "right",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    paddingVertical: 9,
    paddingHorizontal: 7,
  },
  totalStripeValue: {
    width: "22%",
    textAlign: "right",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: RED,
    paddingVertical: 9,
    paddingHorizontal: 7,
  },

  /* Resumo (subtotal / desconto adicional) */
  resumo: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  resumoBox: { width: "38%" },
  resumoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  resumoKey: { fontSize: 9.5, color: GRAY },
  resumoVal: { fontSize: 9.5, color: "#374151" },

  /* Faixa de pagamento / emissão */
  pgto: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 9,
  },
  pgtoCol: { width: "48%" },
  pgtoKey: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: GRAY, textTransform: "uppercase", letterSpacing: 0.4 },
  pgtoVal: { fontSize: 10, color: "#374151", marginTop: 2 },

  obs: { marginTop: 12 },
  obsTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  obsText: { fontSize: 9.5, lineHeight: 1.45, color: "#374151" },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 34,
    right: 34,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#9ca3af",
    borderTopWidth: 1,
    borderTopColor: HAIR,
    paddingTop: 6,
  },
});

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const pct = (n: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(n) || 0)}%`;
const cascataTxt = (c?: number[] | null) =>
  (c ?? []).map((x) => String(x).replace(".", ",")).join(" + ");

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
    cascata?: number[];
    precoManual?: boolean;
    precoFinal: number;
    total: number;
  }[];
  subtotal: number;
  descontoPct: number;
  descontoValor: number;
  descontoCascata?: number[];
  total: number;
  observacaoCliente?: string | null;
}

/** react-pdf não renderiza SVG via <Image> — só usa PNG/JPG/WEBP/data-uri. */
function usableImg(src?: string | null): string | null {
  if (!src) return null;
  if (/\.svg(\?|$)/i.test(src)) return null;
  return src;
}

function Field({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <View style={s.field}>
      <Text style={s.fKey}>{k}: </Text>
      <Text style={s.fVal}>{v}</Text>
    </View>
  );
}

export default function PedidoPDF({ d }: { d: PedidoPDFData }) {
  const empLogo = usableImg(d.empresa.logo);
  const repLogo = usableImg(d.representada.logo);
  const totalUnidades = d.itens.reduce((acc, it) => acc + (Number(it.qtd) || 0), 0);
  const temDescontoAdicional = Number(d.descontoValor) > 0 || Number(d.descontoPct) > 0;

  return (
    <Document title={`Pedido ${d.numero} — ${d.empresa.nome}`} author={d.empresa.nome}>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Cabeçalho */}
        <View style={s.header}>
          <View style={s.hLeft}>
            {empLogo ? <PdfImage src={empLogo} style={s.logo} /> : null}
          </View>
          <View style={s.hCenter}>
            <Text style={s.empNome}>{d.empresa.nome}</Text>
            <Text style={s.empContato}>{d.empresa.contato}</Text>
            <Text style={s.pedidoNum}>PEDIDO Nº {d.numero}</Text>
          </View>
          <View style={s.hRight}>
            {repLogo ? (
              <PdfImage src={repLogo} style={s.logo} />
            ) : (
              <Text style={s.repNome}>{d.representada.nome}</Text>
            )}
          </View>
        </View>

        {/* Representada + data/status */}
        <View style={s.band}>
          <Text style={s.bandKey}>
            Representada: <Text style={s.bandVal}>{d.representada.nome}</Text>
            {d.representada.cnpj ? <Text style={s.bandVal}>  ·  CNPJ {d.representada.cnpj}</Text> : null}
          </Text>
          <Text style={s.bandVal}>
            {d.data}  ·  {d.statusLabel}
          </Text>
        </View>

        {/* Cliente */}
        <View style={s.cliente}>
          <View style={s.cliCol}>
            <Field k="Cliente" v={d.cliente.razao || d.cliente.nome} />
            <Field k="Nome fantasia" v={d.cliente.razao ? d.cliente.nome : null} />
            <Field k="CNPJ/CPF" v={d.cliente.documento} />
            <Field k="Inscr. estadual" v={d.cliente.inscricaoEstadual} />
            <Field k="Endereço" v={d.cliente.endereco} />
          </View>
          <View style={s.cliCol}>
            <Field k="Bairro" v={d.cliente.bairro} />
            <Field k="Cidade / UF" v={d.cliente.cidadeUf} />
            <Field k="CEP" v={d.cliente.cep} />
            <Field k="Telefone" v={d.cliente.telefone} />
            <Field k="E-mail" v={d.cliente.email} />
          </View>
        </View>

        {/* Itens */}
        <View style={s.table}>
          <View style={[s.tr, s.trHead]} fixed>
            <Text style={[s.th, s.cNum]}>#</Text>
            <Text style={[s.th, s.cCod]}>Código</Text>
            <Text style={[s.th, s.cProd]}>Produto</Text>
            <Text style={[s.th, s.cQtd]}>Qtde.</Text>
            <Text style={[s.th, s.cPreco]}>Preço tabela</Text>
            <Text style={[s.th, s.cDesc]}>Desc.</Text>
            <Text style={[s.th, s.cLiq]}>Preço líq.</Text>
            <Text style={[s.th, s.cSub]}>Subtotal</Text>
          </View>
          {d.itens.map((it, i) => {
            const rowStyle = [
              s.tr,
              i % 2 === 1 ? s.trZebra : {},
              i === d.itens.length - 1 ? s.trLast : {},
            ];
            return (
              <View key={i} style={rowStyle} wrap={false}>
                <Text style={[s.td, s.cNum]}>{i + 1}</Text>
                <Text style={[s.td, s.cCod, s.tdStrong]}>{it.sku}</Text>
                <Text style={[s.td, s.cProd]}>{it.descricao}</Text>
                <Text style={[s.td, s.cQtd]}>{it.qtd}</Text>
                <Text style={[s.td, s.cPreco]}>{brl(it.preco)}</Text>
                {it.cascata && it.cascata.length > 1 ? (
                  <View style={[s.tdDescCell, s.cDesc]}>
                    <Text style={s.tdDescMain}>{pct(it.descPct)}</Text>
                    <Text style={s.tdMini}>{cascataTxt(it.cascata)}</Text>
                  </View>
                ) : it.precoManual ? (
                  <View style={[s.tdDescCell, s.cDesc]}>
                    <Text style={s.tdDescMain}>{it.descPct > 0 ? pct(it.descPct) : "—"}</Text>
                    <Text style={s.tdMini}>preço manual</Text>
                  </View>
                ) : (
                  <Text style={[s.td, s.cDesc]}>{it.descPct > 0 ? pct(it.descPct) : "—"}</Text>
                )}
                <Text style={[s.td, s.cLiq]}>{brl(it.precoFinal)}</Text>
                <Text style={[s.td, s.cSub, s.tdStrong]}>{brl(it.total)}</Text>
              </View>
            );
          })}
        </View>

        {/* Linha do valor total, colada à tabela */}
        <View style={s.totalStripe}>
          <Text style={s.totalStripeLabel}>
            {d.itens.length} {d.itens.length === 1 ? "item" : "itens"} · {totalUnidades} un. — VALOR TOTAL
          </Text>
          <Text style={s.totalStripeValue}>{brl(d.total)}</Text>
        </View>

        {/* Resumo (só quando há desconto adicional no pedido) */}
        {temDescontoAdicional ? (
          <View style={s.resumo}>
            <View style={s.resumoBox}>
              <View style={s.resumoRow}>
                <Text style={s.resumoKey}>Subtotal dos itens</Text>
                <Text style={s.resumoVal}>{brl(d.subtotal)}</Text>
              </View>
              <View style={s.resumoRow}>
                <Text style={s.resumoKey}>
                  Desconto adicional (
                  {d.descontoCascata && d.descontoCascata.length > 1
                    ? `${cascataTxt(d.descontoCascata)} = ${pct(d.descontoPct)}`
                    : pct(d.descontoPct)}
                  )
                </Text>
                <Text style={s.resumoVal}>- {brl(d.descontoValor)}</Text>
              </View>
              <View style={s.resumoRow}>
                <Text style={[s.resumoKey, { fontFamily: "Helvetica-Bold", color: DARK }]}>Total</Text>
                <Text style={[s.resumoVal, { fontFamily: "Helvetica-Bold", color: RED }]}>
                  {brl(d.total)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Pagamento / condições */}
        <View style={s.pgto}>
          <View style={s.pgtoCol}>
            <Text style={s.pgtoKey}>Condição de pagamento</Text>
            <Text style={s.pgtoVal}>
              {[d.condicao_pagamento, d.forma_pagamento].filter(Boolean).join(" · ") || "—"}
            </Text>
            {d.tabela ? (
              <>
                <Text style={[s.pgtoKey, { marginTop: 8 }]}>Tabela de preços</Text>
                <Text style={s.pgtoVal}>{d.tabela}</Text>
              </>
            ) : null}
          </View>
          <View style={s.pgtoCol}>
            <Text style={s.pgtoKey}>Data de emissão</Text>
            <Text style={s.pgtoVal}>{d.data}</Text>
            {d.previsao_entrega ? (
              <>
                <Text style={[s.pgtoKey, { marginTop: 8 }]}>Previsão de entrega</Text>
                <Text style={s.pgtoVal}>{d.previsao_entrega}</Text>
              </>
            ) : null}
            {d.vendedor ? (
              <>
                <Text style={[s.pgtoKey, { marginTop: 8 }]}>Vendedor</Text>
                <Text style={s.pgtoVal}>{d.vendedor}</Text>
              </>
            ) : null}
          </View>
        </View>

        {d.observacaoCliente ? (
          <View style={s.obs}>
            <Text style={s.obsTitle}>Observações</Text>
            <Text style={s.obsText}>{d.observacaoCliente}</Text>
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text>
            {d.empresa.nome} · {d.empresa.contato}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
