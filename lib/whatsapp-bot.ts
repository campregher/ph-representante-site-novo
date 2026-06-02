import { createAdminClient }  from "@/lib/supabase/server";
import { sendText, getMediaBase64 } from "@/lib/evolution";
import { getProducts }              from "@/lib/produtos";
import { sendNewOrderAlert }        from "@/lib/email";

// ── Types ──────────────────────────────────────────────────────────────────

type DB = Awaited<ReturnType<typeof createAdminClient>>;

interface Item     { produto_sku: string; produto_nome: string; quantidade: number; valor_unitario: number }
interface Etiqueta { nome: string; url: string }

interface Session {
  id:               string;
  phone:            string;
  cliente_id:       string | null;
  state:            string;
  opcoes:           string[];
  marca_slug:       string | null;
  tipo_pedido:      string | null;
  condicao:         string | null;
  items:            Item[];
  etiquetas:        Etiqueta[];
  horario_postagem: string | null;
}

export interface IncomingMsg {
  phone:      string;
  text:       string | null;
  msgKey?:    Record<string, unknown>;
  msgContent?: Record<string, unknown>;
  mediaName?: string;
  mediaMime?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function condLabel(c: string) {
  return ({ pix: "PIX à vista", boleto: "Boleto", semanal: "Semanal" } as Record<string, string>)[c] ?? c;
}

function parseSKUs(text: string): { sku: string; qty: number }[] {
  return text
    .split("/")
    .map(s => s.trim())
    .filter(Boolean)
    .flatMap(p => {
      const m = p.match(/^([A-Za-z0-9]+)\s*[-–]\s*(\d+)$/);
      return m ? [{ sku: m[1].toUpperCase(), qty: parseInt(m[2]) }] : [];
    });
}

async function getSession(db: DB, phone: string): Promise<Session> {
  const { data } = await db.from("whatsapp_sessions").select("*").eq("phone", phone).maybeSingle();
  if (data) return data as unknown as Session;

  const blank = {
    phone, cliente_id: null, state: "idle", opcoes: [],
    marca_slug: null, tipo_pedido: null, condicao: null,
    items: [], etiquetas: [], horario_postagem: null,
  };
  const { data: row } = await db.from("whatsapp_sessions").insert(blank).select().single();
  return row as unknown as Session;
}

async function patch(db: DB, phone: string, data: Record<string, unknown>) {
  await db.from("whatsapp_sessions").update({ ...data, updated_at: new Date().toISOString() }).eq("phone", phone);
}

async function reset(db: DB, phone: string) {
  await patch(db, phone, {
    state: "idle", cliente_id: null, opcoes: [], marca_slug: null,
    tipo_pedido: null, condicao: null, items: [], etiquetas: [], horario_postagem: null,
  });
}

async function findCliente(db: DB, phone: string) {
  const last8 = phone.replace(/\D/g, "").slice(-8);
  const { data } = await db
    .from("clientes")
    .select("id, razao_social, nome_fantasia, status, bloqueado, email, whatsapp")
    .ilike("whatsapp", `%${last8}%`)
    .limit(10);
  if (!data?.length) return null;
  const norm = phone.replace(/\D/g, "").slice(-11);
  return (data as Array<Record<string, string>>).find(
    c => (c.whatsapp ?? "").replace(/\D/g, "").slice(-11) === norm
  ) ?? null;
}

// ── State handlers ─────────────────────────────────────────────────────────

async function onIdle(db: DB, s: Session, msg: IncomingMsg) {
  if (!msg.text || !/pedido/i.test(msg.text)) {
    await sendText(s.phone, "Olá! Envie *pedido* para iniciar um novo pedido.");
    return;
  }

  const cliente = await findCliente(db, s.phone);
  if (!cliente) {
    await sendText(s.phone, "Não encontramos seu cadastro. Verifique se seu WhatsApp está cadastrado no portal ou entre em contato com a PH Representante.");
    return;
  }
  if (cliente.bloqueado) {
    await sendText(s.phone, "Sua conta está bloqueada para novos pedidos. Entre em contato com a PH Representante.");
    return;
  }
  if (cliente.status !== "aprovado") {
    await sendText(s.phone, "Seu cadastro ainda não foi aprovado. Aguarde a aprovação para fazer pedidos.");
    return;
  }

  const { data: marcaClientes } = await db
    .from("marca_clientes")
    .select("marca_slug")
    .eq("cliente_id", cliente.id)
    .eq("status", "aprovado")
    .eq("bloqueado", false);

  if (!marcaClientes?.length) {
    await sendText(s.phone, "Você ainda não tem acesso aprovado a nenhuma marca. Acesse o portal e solicite acesso.");
    return;
  }

  const slugs = (marcaClientes as Array<{ marca_slug: string }>).map(mc => mc.marca_slug);
  const { data: marcas } = await db.from("marcas").select("slug, name").in("slug", slugs);

  const list   = (marcas ?? []) as Array<{ slug: string; name: string }>;
  const opcoes = list.map(m => m.slug);
  const lines  = list.map((m, i) => `${i + 1}. ${m.name}`).join("\n");

  await patch(db, s.phone, { state: "selecting_brand", cliente_id: cliente.id, opcoes });

  const nome = (cliente.nome_fantasia || cliente.razao_social) as string;
  await sendText(s.phone, `Olá, *${nome}*! 👋\n\nSuas marcas disponíveis:\n${lines}\n\nDigite o número da marca:`);
}

async function onSelectBrand(db: DB, s: Session, msg: IncomingMsg) {
  const n = parseInt(msg.text?.trim() ?? "");
  if (!n || n < 1 || n > s.opcoes.length) {
    await sendText(s.phone, `Digite um número de 1 a ${s.opcoes.length}.`);
    return;
  }

  await patch(db, s.phone, { state: "selecting_type", marca_slug: s.opcoes[n - 1] });
  await sendText(s.phone, "Tipo de pedido:\n\n1. Estoque\n2. Dropshipping\n\nDigite 1 ou 2:");
}

async function onSelectType(db: DB, s: Session, msg: IncomingMsg) {
  const t = msg.text?.trim();
  if (t !== "1" && t !== "2") {
    await sendText(s.phone, "Digite *1* para Estoque ou *2* para Dropshipping.");
    return;
  }

  const tipo = t === "1" ? "estoque" : "dropshipping";
  await patch(db, s.phone, { tipo_pedido: tipo });

  if (tipo === "dropshipping") {
    await patch(db, s.phone, { state: "receiving_etiquetas" });
    await sendText(s.phone,
      "📎 Envie as etiquetas de envio.\n\nPode ser um arquivo por vez ou um único PDF com todas.\nCada etiqueta deve ter o *SKU do produto*.\n\nQuando terminar, responda: *pronto*"
    );
  } else {
    await patch(db, s.phone, { state: "adding_items" });
    await sendText(s.phone, "Envie os produtos no formato:\n\n*SKU - QTD / SKU - QTD*\n\nEx: 020tb - 1 / 010tb - 2 / 023tb - 10");
  }
}

async function onReceivingEtiquetas(db: DB, s: Session, msg: IncomingMsg) {
  if (msg.text && /^pronto$/i.test(msg.text.trim())) {
    if (!s.etiquetas.length) {
      await sendText(s.phone, "Nenhuma etiqueta recebida. Envie ao menos um arquivo antes de continuar.");
      return;
    }
    await patch(db, s.phone, { state: "awaiting_postagem" });
    await sendText(s.phone, `✅ ${s.etiquetas.length} etiqueta(s) recebida(s).\n\n📅 Informe o horário limite de postagem:\nEx: 04/06 às 12:00`);
    return;
  }

  if (msg.msgKey && msg.msgContent) {
    const media = await getMediaBase64(msg.msgKey, msg.msgContent);
    if (!media?.base64) {
      await sendText(s.phone, "Não consegui processar o arquivo. Tente enviar novamente.");
      return;
    }

    const ext      = (media.mimetype ?? "").split("/")[1]?.split(";")[0] ?? "bin";
    const fileName = msg.mediaName || `etiqueta-${Date.now()}.${ext}`;
    const buffer   = Buffer.from(media.base64, "base64");
    const path     = `whatsapp/${s.cliente_id}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error } = await db.storage.from("etiquetas").upload(path, buffer, { contentType: media.mimetype, upsert: false });
    if (error) {
      await sendText(s.phone, "Erro ao salvar o arquivo. Tente novamente.");
      return;
    }

    const { data: { publicUrl } } = db.storage.from("etiquetas").getPublicUrl(path);
    const novas = [...s.etiquetas, { nome: fileName, url: publicUrl }];
    await patch(db, s.phone, { etiquetas: novas });
    await sendText(s.phone, `✅ *${fileName}* recebida (${novas.length} total).\n\nEnvie mais etiquetas ou responda *pronto* para continuar.`);
    return;
  }

  await sendText(s.phone, "Envie os arquivos das etiquetas ou responda *pronto* quando terminar.");
}

async function onPostagem(db: DB, s: Session, msg: IncomingMsg) {
  const horario = msg.text?.trim();
  if (!horario) {
    await sendText(s.phone, "Informe o horário limite de postagem. Ex: 04/06 às 12:00");
    return;
  }

  await patch(db, s.phone, { horario_postagem: horario, state: "adding_items" });
  await sendText(s.phone, `📅 Postagem até *${horario}*.\n\nAgora envie os produtos:\n\n*SKU - QTD / SKU - QTD*\n\nEx: 020tb - 1 / 010tb - 2`);
}

async function onAddItems(db: DB, s: Session, msg: IncomingMsg) {
  const text = msg.text?.trim();
  if (!text) {
    await sendText(s.phone, "Envie os SKUs no formato:\n\n*SKU - QTD / SKU - QTD*");
    return;
  }

  const parsed = parseSKUs(text);
  if (!parsed.length) {
    await sendText(s.phone, "Formato inválido. Use:\n\n*SKU - QTD / SKU - QTD*\n\nEx: 020tb - 1 / 010tb - 2");
    return;
  }

  const products  = await getProducts({ brand: s.marca_slug!, activeOnly: true });
  const items: Item[]    = [];
  const notFound: string[] = [];

  for (const { sku, qty } of parsed) {
    const p = products.find(pr => pr.sku.toUpperCase() === sku);
    if (!p) { notFound.push(sku); continue; }
    items.push({ produto_sku: p.sku, produto_nome: p.name, quantidade: qty, valor_unitario: p.price ?? 0 });
  }

  if (notFound.length) {
    await sendText(s.phone, `SKU(s) não encontrado(s): *${notFound.join(", ")}*\n\nVerifique e tente novamente.`);
    return;
  }

  const { data: mc } = await db
    .from("marca_clientes")
    .select("condicoes_pagamento_drop")
    .eq("marca_slug", s.marca_slug!)
    .eq("cliente_id", s.cliente_id!)
    .single();

  const condicao = ((mc?.condicoes_pagamento_drop as string[] | null)?.[0]) ?? "pix";
  const total    = items.reduce((sum, i) => sum + i.quantidade * i.valor_unitario, 0);

  const itemLines = items
    .map(i => `  ${i.produto_sku} × ${i.quantidade} — ${fmt(i.valor_unitario)} = ${fmt(i.quantidade * i.valor_unitario)}`)
    .join("\n");

  let resumo = `📦 *Resumo do pedido*\n\n${itemLines}\n${"─".repeat(28)}\nTotal: *${fmt(total)}*\nCondição: *${condLabel(condicao)}*`;
  if (s.tipo_pedido === "dropshipping") {
    resumo += `\nEtiquetas: *${s.etiquetas.length} arquivo(s)*`;
    resumo += `\nPostagem até: *${s.horario_postagem}*`;
  }
  resumo += "\n\nConfirmar? Responda *sim* ou *não*";

  await patch(db, s.phone, { items, condicao, state: "confirming" });
  await sendText(s.phone, resumo);
}

async function onConfirming(db: DB, s: Session, msg: IncomingMsg) {
  const t = msg.text?.trim().toLowerCase() ?? "";

  if (!["sim", "s", "não", "nao", "n"].includes(t)) {
    await sendText(s.phone, "Responda *sim* para confirmar ou *não* para cancelar.");
    return;
  }

  if (["não", "nao", "n"].includes(t)) {
    await reset(db, s.phone);
    await sendText(s.phone, "Pedido cancelado. Envie *pedido* para recomeçar.");
    return;
  }

  try {
    const { data: orcamento, error: oErr } = await db.from("orcamentos").insert({
      cliente_id:         s.cliente_id,
      marca:              s.marca_slug,
      tipo_pedido:        s.tipo_pedido,
      condicao_pagamento: s.condicao,
      horario_postagem:   s.tipo_pedido === "dropshipping" ? s.horario_postagem : null,
      status:             "enviado",
    }).select().single();
    if (oErr) throw new Error(oErr.message);

    await db.from("orcamento_itens").insert(
      s.items.map(i => ({ orcamento_id: orcamento.id, ...i }))
    );

    if (s.tipo_pedido === "dropshipping" && s.etiquetas.length > 0) {
      await db.from("orcamento_etiquetas").insert(
        s.etiquetas.map(e => ({ orcamento_id: orcamento.id, nome: e.nome, url: e.url }))
      );
    }

    const total = s.items.reduce((sum, i) => sum + i.quantidade * i.valor_unitario, 0);
    if (total > 0) await db.from("orcamentos").update({ total }).eq("id", orcamento.id);

    const [{ data: brand }, { data: cliente }] = await Promise.all([
      db.from("marcas").select("name, email").eq("slug", s.marca_slug!).single(),
      db.from("clientes").select("razao_social").eq("id", s.cliente_id!).single(),
    ]);

    const toEmail = (brand as Record<string, string> | null)?.email ?? process.env.EMAIL_ADMIN;
    if (toEmail) {
      const now    = new Date(orcamento.created_at);
      const dataBR = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      const horaBR = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      sendNewOrderAlert({
        id: orcamento.id, numero: orcamento.numero, dataBR, horaBR,
        tipoPedido:  s.tipo_pedido!,
        brandEmail:  toEmail,
        brandName:   (brand as Record<string, string> | null)?.name ?? s.marca_slug!,
        brandSlug:   s.marca_slug!,
        clienteNome: (cliente as Record<string, string> | null)?.razao_social ?? "",
        total, observacoes: null,
      }).catch(() => {});
    }

    await reset(db, s.phone);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    await sendText(s.phone, `✅ *Pedido #${orcamento.numero} enviado com sucesso!*\n\nAcompanhe em:\n${siteUrl}/portal/orcamentos`);
  } catch (err) {
    console.error("[whatsapp-bot] criar pedido:", err);
    await sendText(s.phone, "Erro ao criar o pedido. Tente novamente ou acesse o portal.");
  }
}

// ── Entry point ────────────────────────────────────────────────────────────

export async function handleWhatsApp(msg: IncomingMsg): Promise<void> {
  const db = await createAdminClient();
  const s  = await getSession(db, msg.phone);

  if (msg.text && /^cancelar$/i.test(msg.text.trim())) {
    await reset(db, msg.phone);
    await sendText(msg.phone, "Pedido cancelado. Envie *pedido* para recomeçar.");
    return;
  }

  switch (s.state) {
    case "idle":                return onIdle(db, s, msg);
    case "selecting_brand":     return onSelectBrand(db, s, msg);
    case "selecting_type":      return onSelectType(db, s, msg);
    case "receiving_etiquetas": return onReceivingEtiquetas(db, s, msg);
    case "awaiting_postagem":   return onPostagem(db, s, msg);
    case "adding_items":        return onAddItems(db, s, msg);
    case "confirming":          return onConfirming(db, s, msg);
  }
}
