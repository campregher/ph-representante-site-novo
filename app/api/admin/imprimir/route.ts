import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function adminDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Item { produto_sku: string; produto_nome: string; quantidade: number; valor_unitario: number; valor_total: number }
interface Etiqueta { nome: string; url: string }

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value ?? "";
  if (!(await verifyToken(token))) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids")?.split(",").filter(Boolean).slice(0, 50) ?? [];
  if (!ids.length) return new NextResponse("IDs não informados", { status: 400 });

  const db = adminDb();
  const { data: orcamentos } = await db
    .from("orcamentos")
    .select("*, orcamento_itens(*), orcamento_etiquetas(*), clientes(razao_social, nome_fantasia, cnpj, email, whatsapp, logradouro, numero, bairro, cidade, estado)")
    .in("id", ids)
    .order("numero", { ascending: true });

  if (!orcamentos?.length) return new NextResponse("Não encontrado", { status: 404 });

  const slugs = [...new Set(orcamentos.map((o) => o.marca).filter(Boolean))] as string[];
  const { data: marcas } = slugs.length
    ? await db.from("marcas").select("slug, name, razao_social, cnpj, email, telefone, logradouro, numero, bairro, cidade, estado").in("slug", slugs)
    : { data: [] };
  const brandMap = Object.fromEntries((marcas ?? []).map((m: { slug: string }) => [m.slug, m]));

  const statusLabels: Record<string, string> = {
    rascunho:     "Rascunho",
    enviado:      "Enviado",
    em_separacao: "Em Separação",
    a_pagar:      "A Pagar",
    pago:         "Pago",
    recusado:     "Recusado",
    finalizado:   "Finalizado",
  };

  const statusStyle: Record<string, string> = {
    rascunho:     "background:#f3f4f6;color:#6b7280;border:0.5pt solid #d1d5db",
    enviado:      "background:#fef9c3;color:#a16207;border:0.5pt solid #fde68a",
    em_separacao: "background:#eff6ff;color:#1d4ed8;border:0.5pt solid #bfdbfe",
    a_pagar:      "background:#fff7ed;color:#c2410c;border:0.5pt solid #fed7aa",
    pago:         "background:#dcfce7;color:#15803d;border:0.5pt solid #bbf7d0",
    recusado:     "background:#fee2e2;color:#b91c1c;border:0.5pt solid #fca5a5",
    finalizado:   "background:#e0e7ff;color:#4338ca;border:0.5pt solid #c7d2fe",
  };

  function addr(obj: Record<string, string | null | undefined> | null) {
    if (!obj) return "";
    return [
      obj.logradouro && `${obj.logradouro}${obj.numero ? `, ${obj.numero}` : ""}`,
      obj.bairro,
      obj.cidade && obj.estado ? `${obj.cidade} / ${obj.estado}` : (obj.cidade ?? obj.estado),
    ].filter(Boolean).join(" · ");
  }

  const pages = orcamentos.map((o) => {
    const itens     = (o.orcamento_itens ?? []) as Item[];
    const etiquetas = (o.orcamento_etiquetas ?? []) as Etiqueta[];
    const total     = itens.reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
    const brand     = o.marca ? brandMap[o.marca] as Record<string, string | null | undefined> | undefined : null;
    const cliente   = o.clientes as Record<string, string | null | undefined> | null;
    const isDrop    = o.tipo_pedido === "dropshipping";
    const dataBR    = new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const horaBR    = new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const sBg       = statusStyle[o.status] ?? statusStyle.rascunho;
    const sLabel    = statusLabels[o.status] ?? o.status;

    const brandName = (brand?.name as string) ?? o.marca ?? "—";

    const pagamento = o.condicao_pagamento === "pix"
      ? "PIX"
      : o.condicao_pagamento === "semanal"
        ? "Semanal (sexta-feira)"
        : o.condicao_pagamento === "boleto"
          ? `Boleto${o.prazo_boleto ? ` — ${o.prazo_boleto} dias` : ""}`
          : (o.condicao_pagamento ?? "");

    const rows = itens.map((item, idx) => `
      <tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"}">
        <td style="padding:6px 8px;border-bottom:0.5pt solid #f3f4f6;vertical-align:top">
          <span style="font-size:6.5pt;font-weight:700;color:#c0392b;display:block;margin-bottom:1px">${item.produto_sku}</span>
          <span style="font-size:8.5pt;color:#111">${item.produto_nome}</span>
        </td>
        <td style="padding:6px 8px;border-bottom:0.5pt solid #f3f4f6;text-align:center;font-size:9pt;font-weight:700;color:#111">${item.quantidade}</td>
        <td style="padding:6px 8px;border-bottom:0.5pt solid #f3f4f6;text-align:right;font-size:8pt;color:#374151">${Number(item.valor_unitario) > 0 ? fmt(Number(item.valor_unitario)) : "—"}</td>
        <td style="padding:6px 8px;border-bottom:0.5pt solid #f3f4f6;text-align:right;font-size:8.5pt;font-weight:700;color:#111">${Number(item.valor_total) > 0 ? fmt(Number(item.valor_total)) : "—"}</td>
      </tr>`).join("");

    const etiquetasHtml = isDrop && etiquetas.length > 0 ? `
      <div style="margin-top:14px;padding:10px 12px;background:#fffbeb;border:0.5pt solid #fde68a;border-radius:6px">
        <div style="font-size:7pt;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">⚠ Pedido Dropshipping — Etiquetas de envio</div>
        ${etiquetas.map((et) => `<div style="font-size:7.5pt;color:#78350f;margin-bottom:3px;padding-left:8px">• ${et.nome}</div>`).join("")}
      </div>` : "";

    const brandHtml = brand ? `
      <div style="font-size:9.5pt;font-weight:700;color:#111;margin-bottom:2px">${brandName}</div>
      ${brand.razao_social ? `<div style="font-size:7.5pt;color:#4b5563;margin-bottom:3px">${brand.razao_social}</div>` : ""}
      ${brand.cnpj     ? `<div style="font-size:7pt;color:#6b7280;margin-bottom:2px">CNPJ: ${brand.cnpj}</div>` : ""}
      ${brand.email    ? `<div style="font-size:7pt;color:#6b7280;margin-bottom:2px">${brand.email}</div>` : ""}
      ${brand.telefone ? `<div style="font-size:7pt;color:#6b7280;margin-bottom:2px">${brand.telefone}</div>` : ""}
      ${addr(brand)    ? `<div style="font-size:7pt;color:#6b7280">${addr(brand)}</div>` : ""}
    ` : "<div style='font-size:7.5pt;color:#9ca3af'>—</div>";

    const clienteHtml = cliente ? `
      <div style="font-size:9.5pt;font-weight:700;color:#111;margin-bottom:2px">${cliente.razao_social}</div>
      ${cliente.nome_fantasia ? `<div style="font-size:7.5pt;color:#4b5563;margin-bottom:3px">${cliente.nome_fantasia}</div>` : ""}
      ${cliente.cnpj     ? `<div style="font-size:7pt;color:#6b7280;margin-bottom:2px">CNPJ: ${cliente.cnpj}</div>` : ""}
      ${cliente.email    ? `<div style="font-size:7pt;color:#6b7280;margin-bottom:2px">${cliente.email}</div>` : ""}
      ${cliente.whatsapp ? `<div style="font-size:7pt;color:#6b7280;margin-bottom:2px">${cliente.whatsapp}</div>` : ""}
      ${addr(cliente)    ? `<div style="font-size:7pt;color:#6b7280">${addr(cliente)}</div>` : ""}
    ` : "<div style='font-size:7.5pt;color:#9ca3af'>—</div>";

    return `
<div style="width:210mm;min-height:297mm;padding:12mm 16mm 14mm;background:#fff;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;page-break-after:always;box-sizing:border-box;position:relative">

  <!-- Barra superior -->
  <div style="height:4px;background:#c0392b;border-radius:2px;margin-bottom:18px"></div>

  <!-- Cabeçalho -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
    <div>
      <div style="font-size:7pt;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Fornecedor</div>
      <div style="font-size:16pt;font-weight:900;color:#111;letter-spacing:-0.5px;line-height:1.1">${brandName}</div>
      ${brand?.razao_social ? `<div style="font-size:7.5pt;color:#4b5563;margin-top:2px">${brand.razao_social}</div>` : ""}
      ${brand?.cnpj         ? `<div style="font-size:7pt;color:#9ca3af;margin-top:1px">CNPJ: ${brand.cnpj}</div>` : ""}
      ${brand?.email        ? `<div style="font-size:7pt;color:#9ca3af;margin-top:1px">${brand.email}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div style="font-size:7pt;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Pedido</div>
      <div style="font-size:28pt;font-weight:900;color:#111;line-height:1;margin-top:2px">#${o.numero}</div>
      <div style="font-size:7pt;color:#6b7280;margin-top:4px">${dataBR}</div>
      <div style="font-size:7pt;color:#9ca3af">${horaBR}</div>
    </div>
  </div>

  <!-- Badges -->
  <div style="display:flex;align-items:center;gap:5px;padding:8px 0;border-top:0.5pt solid #f3f4f6;border-bottom:0.5pt solid #f3f4f6;margin-bottom:14px;flex-wrap:wrap">
    <span style="font-size:6.5pt;font-weight:700;color:#c0392b;background:#fff5f5;border:0.5pt solid #fca5a5;border-radius:20px;padding:2px 8px">PH Representante</span>
    <span style="font-size:6.5pt;font-weight:700;${isDrop ? "color:#1d4ed8;background:#eff6ff;border:0.5pt solid #bfdbfe" : "color:#374151;background:#f3f4f6;border:0.5pt solid #d1d5db"};border-radius:20px;padding:2px 8px">${isDrop ? "Dropshipping" : "Estoque"}</span>
    <span style="font-size:6.5pt;font-weight:700;${sBg};border-radius:20px;padding:2px 8px">${sLabel}</span>
    <div style="flex:1;min-width:0"></div>
    <span style="font-size:6.5pt;color:#9ca3af">Emitido em ${dataBR} · ${horaBR}</span>
  </div>

  <!-- Partes -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border:0.5pt solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px">
    <div style="padding:12px;background:#fafafa">
      <div style="font-size:6pt;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Fornecedor</div>
      ${brandHtml}
    </div>
    <div style="padding:12px;border-left:0.5pt solid #e5e7eb">
      <div style="font-size:6pt;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Comprador</div>
      ${clienteHtml}
    </div>
  </div>

  <!-- Itens -->
  <div style="font-size:6.5pt;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Itens do pedido</div>
  <table style="width:100%;border-collapse:collapse;border:0.5pt solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:16px">
    <thead>
      <tr style="background:#f3f4f6">
        <th style="font-size:6.5pt;font-weight:700;color:#6b7280;padding:6px 8px;text-align:left;border-bottom:0.5pt solid #e5e7eb">Produto</th>
        <th style="font-size:6.5pt;font-weight:700;color:#6b7280;padding:6px 8px;text-align:center;width:45px;border-bottom:0.5pt solid #e5e7eb">Qtd</th>
        <th style="font-size:6.5pt;font-weight:700;color:#6b7280;padding:6px 8px;text-align:right;width:80px;border-bottom:0.5pt solid #e5e7eb">Valor unit.</th>
        <th style="font-size:6.5pt;font-weight:700;color:#6b7280;padding:6px 8px;text-align:right;width:85px;border-bottom:0.5pt solid #e5e7eb">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- Condições + Total -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:14px">
    <div style="flex:1">
      <div style="font-size:6.5pt;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Condições</div>
      ${pagamento ? `<div style="font-size:8.5pt;color:#374151;margin-bottom:3px">💳 Pagamento: <strong>${pagamento}</strong></div>` : ""}
      ${o.transportadora ? `<div style="font-size:8pt;color:#374151;margin-bottom:3px">🚚 Transportadora: ${o.transportadora}</div>` : ""}
      ${o.observacoes ? `<div style="font-size:7.5pt;color:#6b7280;margin-top:6px;font-style:italic;padding:6px 8px;background:#f9fafb;border-radius:4px;border-left:2pt solid #e5e7eb">Obs: ${o.observacoes}</div>` : ""}
    </div>
    <div style="background:#c0392b;color:#fff;padding:10px 18px;border-radius:10px;text-align:right;flex-shrink:0;min-width:120px">
      <div style="font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.8px;opacity:.8;margin-bottom:3px">Total geral</div>
      <div style="font-size:17pt;font-weight:900;line-height:1">${total > 0 ? fmt(total) : "A definir"}</div>
    </div>
  </div>

  ${etiquetasHtml}

  <!-- Rodapé -->
  <div style="position:absolute;bottom:14mm;left:16mm;right:16mm">
    <div style="border-top:0.5pt solid #e5e7eb;padding-top:7px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:6pt;color:#9ca3af">PH Representante — Representação Comercial Automotiva</span>
      <span style="font-size:6pt;color:#9ca3af">Pedido #${o.numero} · ${brandName}</span>
    </div>
    <div style="height:3px;background:#c0392b;border-radius:2px;margin-top:7px;opacity:.4"></div>
  </div>

</div>`;
  });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Pedidos PH Representante</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: #d1d5db; font-family: Arial, Helvetica, sans-serif; }
    @media print {
      html, body { background: #fff; }
      @page { margin: 0; size: A4; }
      .no-print { display: none !important; }
    }
    .print-btn {
      position: fixed; bottom: 24px; right: 24px;
      padding: 12px 28px; background: #c0392b; color: #fff;
      border: none; border-radius: 12px; font-size: 14px;
      font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 20px rgba(192,57,43,.5);
      z-index: 999; font-family: Arial, sans-serif;
    }
    .print-btn:hover { background: #a93226; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨 Imprimir</button>
  ${pages.join("\n")}
  <script>setTimeout(function(){ window.print(); }, 600);</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
