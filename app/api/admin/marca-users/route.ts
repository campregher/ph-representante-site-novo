import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { sendBrandInviteEmail } from "@/lib/email";

export const runtime = "nodejs";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value ?? "";
  return verifyToken(token);
}

// POST — create brand user account
export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { email, marca_slug } = await request.json();
  if (!email || !marca_slug) return NextResponse.json({ error: "email e marca_slug são obrigatórios" }, { status: 400 });

  const db = await createAdminClient();

  // Check if marca exists
  const { data: marca } = await db.from("marcas").select("slug, name").eq("slug", marca_slug).single();
  if (!marca) return NextResponse.json({ error: "Marca não encontrada" }, { status: 404 });

  // Check if this marca already has a user
  const { data: existing } = await db.from("marca_users").select("id").eq("marca_slug", marca_slug).single();
  if (existing) return NextResponse.json({ error: "Esta marca já possui um usuário cadastrado" }, { status: 409 });

  // Create Supabase auth user with a random temp password
  const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-4).toUpperCase() + "!";

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password:       tempPassword,
    email_confirm:  true,
  });

  if (createError) {
    if (createError.message.includes("already registered")) {
      // User already exists — look them up and just link
      const { data: existingUsers } = await db.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find((u) => u.email === email);
      if (!existingUser) return NextResponse.json({ error: "Usuário já existe mas não foi possível localizar" }, { status: 409 });

      // Check if this user is already linked to another marca
      const { data: linked } = await db.from("marca_users").select("marca_slug").eq("user_id", existingUser.id).single();
      if (linked) return NextResponse.json({ error: `Este email já está vinculado à marca: ${linked.marca_slug}` }, { status: 409 });

      await db.from("marca_users").insert({ user_id: existingUser.id, marca_slug });
    } else {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
  } else {
    // Link new user to marca
    const { error: linkError } = await db.from("marca_users").insert({
      user_id:    created.user.id,
      marca_slug,
    });
    if (linkError) {
      // Rollback user creation
      await db.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }
  }

  // Generate password reset link so user can set their own password
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data: linkData } = await db.auth.admin.generateLink({
    type:       "recovery",
    email,
    options: { redirectTo: `${siteUrl}/marca/nova-senha` },
  });

  const resetLink = linkData?.properties?.action_link ?? null;

  // Send invite email with the link
  if (resetLink) {
    sendBrandInviteEmail({ marcaEmail: email, marcaNome: marca.name, resetLink }).catch(
      (err) => console.error("[email-brand-invite]", err)
    );
  }

  return NextResponse.json({
    ok:        true,
    marcaNome: marca.name,
    email,
    resetLink,
  });
}

// GET — list brand users with emails
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = await createAdminClient();
  const { data, error } = await db
    .from("marca_users")
    .select("id, marca_slug, user_id, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  if (rows.length === 0) return NextResponse.json([]);

  const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  return NextResponse.json(rows.map((r) => ({ ...r, email: emailMap.get(r.user_id) ?? "" })));
}

// PATCH — regenerate password reset link for existing brand user
export async function PATCH(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { marca_slug } = await request.json();
  if (!marca_slug) return NextResponse.json({ error: "marca_slug obrigatório" }, { status: 400 });

  const db = await createAdminClient();
  const { data: mu } = await db.from("marca_users").select("user_id").eq("marca_slug", marca_slug).single();
  if (!mu) return NextResponse.json({ error: "Nenhum usuário vinculado a esta marca" }, { status: 404 });

  const { data: authUser } = await db.auth.admin.getUserById(mu.user_id);
  if (!authUser.user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data: linkData } = await db.auth.admin.generateLink({
    type:    "recovery",
    email:   authUser.user.email!,
    options: { redirectTo: `${siteUrl}/marca/nova-senha` },
  });

  const resetLink = linkData?.properties?.action_link ?? null;
  const { data: marcaData } = await db.from("marcas").select("name").eq("slug", marca_slug).single();

  // Send resend email
  if (resetLink && authUser.user.email) {
    sendBrandInviteEmail({
      marcaEmail: authUser.user.email,
      marcaNome:  marcaData?.name ?? marca_slug,
      resetLink,
      isResend:   true,
    }).catch((err) => console.error("[email-brand-invite-resend]", err));
  }

  return NextResponse.json({ ok: true, email: authUser.user.email, resetLink });
}

// DELETE — remove brand user
export async function DELETE(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { user_id } = await request.json();
  if (!user_id) return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });

  const db = await createAdminClient();
  const { error } = await db.from("marca_users").delete().eq("user_id", user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
