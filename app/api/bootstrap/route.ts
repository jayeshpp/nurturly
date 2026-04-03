import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/env";

const BabyInputSchema = z.object({
  name: z.string().min(1),
  birth_date: z.string().min(1), // YYYY-MM-DD
});

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    babies: z.array(BabyInputSchema).min(1),
    tenantName: z.string().min(1).optional(),
  }),
  z.object({
    action: z.literal("join"),
    inviteCode: z.string().min(1),
  }),
]);

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  if (!hasSupabaseEnv) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 400 });
  }
  if (!hasSupabaseServiceRoleEnv) {
    return NextResponse.json({ error: "missing_service_role_key" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  if (parsed.data.action === "create") {
    const tenantName = parsed.data.tenantName ?? "Family";

    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({ name: tenantName })
      .select("id,name")
      .single();

    if (tenantErr || !tenant) {
      console.error("[api/bootstrap] create tenant failed", { requestId, tenantErr });
      return NextResponse.json({ error: "tenant_create_failed" }, { status: 400 });
    }

    const { error: userRowErr } = await admin.from("users").upsert({
      id: user.id,
      tenant_id: tenant.id,
      role: "owner",
      display_name: user.email ?? null,
    });

    if (userRowErr) {
      console.error("[api/bootstrap] upsert user failed", { requestId, userRowErr });
      return NextResponse.json({ error: "user_upsert_failed" }, { status: 400 });
    }

    const babiesToInsert = parsed.data.babies.map((b) => ({
      tenant_id: tenant.id,
      name: b.name,
      birth_date: b.birth_date,
    }));

    const { data: babies, error: babiesErr } = await admin
      .from("babies")
      .insert(babiesToInsert)
      .select("id,name,birth_date")
      .order("created_at", { ascending: true });

    if (babiesErr || !babies || babies.length === 0) {
      console.error("[api/bootstrap] insert babies failed", { requestId, babiesErr });
      return NextResponse.json({ error: "babies_create_failed" }, { status: 400 });
    }

    return NextResponse.json(
      { ok: true, action: "create", tenant, userId: user.id, babies },
      { status: 200 }
    );
  }

  // join
  const { data: invite, error: inviteErr } = await admin
    .from("tenant_invites")
    .select("code,tenant_id,redeemed_at,expires_at")
    .eq("code", parsed.data.inviteCode)
    .single();

  if (inviteErr || !invite) {
    return NextResponse.json({ error: "invalid_invite" }, { status: 400 });
  }

  if (invite.redeemed_at) {
    return NextResponse.json({ error: "invite_already_used" }, { status: 400 });
  }

  if (invite.expires_at && Date.parse(invite.expires_at) < Date.now()) {
    return NextResponse.json({ error: "invite_expired" }, { status: 400 });
  }

  const { error: redeemErr } = await admin
    .from("tenant_invites")
    .update({ redeemed_at: new Date().toISOString(), redeemed_by: user.id })
    .eq("code", parsed.data.inviteCode);

  if (redeemErr) {
    console.error("[api/bootstrap] redeem invite failed", { requestId, redeemErr });
    return NextResponse.json({ error: "invite_redeem_failed" }, { status: 400 });
  }

  const { error: userRowErr } = await admin.from("users").upsert({
    id: user.id,
    tenant_id: invite.tenant_id,
    role: "member",
    display_name: user.email ?? null,
  });

  if (userRowErr) {
    console.error("[api/bootstrap] upsert user failed", { requestId, userRowErr });
    return NextResponse.json({ error: "user_upsert_failed" }, { status: 400 });
  }

  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select("id,name")
    .eq("id", invite.tenant_id)
    .single();

  if (tenantErr || !tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 400 });
  }

  const { data: babies, error: babiesErr } = await admin
    .from("babies")
    .select("id,name,birth_date")
    .eq("tenant_id", invite.tenant_id)
    .order("created_at", { ascending: true });

  if (babiesErr) {
    return NextResponse.json({ error: "babies_fetch_failed" }, { status: 400 });
  }

  return NextResponse.json(
    { ok: true, action: "join", tenant, userId: user.id, babies: babies ?? [] },
    { status: 200 }
  );
}

