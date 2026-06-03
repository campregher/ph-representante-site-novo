import { NextResponse } from "next/server";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET() {
  const store = await cookies();
  const ok    = await verifyToken(store.get(ADMIN_COOKIE)?.value ?? "");
  if (!ok) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const dados = [
    // Linha de exemplo 1
    { Nome: "João Silva", Empresa: "Loja do João", Telefone: "5511999999999", Email: "joao@email.com" },
    // Linha de exemplo 2
    { Nome: "Maria Santos", Empresa: "Boutique Maria", Telefone: "5511988888888", Email: "" },
  ];

  const ws = XLSX.utils.json_to_sheet(dados, {
    header: ["Nome", "Empresa", "Telefone", "Email"],
  });

  // Largura das colunas
  ws["!cols"] = [
    { wch: 30 }, // Nome
    { wch: 30 }, // Empresa
    { wch: 20 }, // Telefone
    { wch: 35 }, // Email
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contatos");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-contatos-whatsapp.xlsx"',
    },
  });
}
