import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/env";

const BodySchema = z.object({
  email: z.string().email().optional(),
  expiresInHours: z.number().int().min(1).max(24 * 30).optional(),
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  if (!hasSupabaseEnv) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 400 });
  }
  if (!hasSupabaseServiceRoleEnv) {
    return NextResponse.json({ error: "missing_service_role_key" }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const admin = createSupabaseAdminClient();

  // Find tenant + role
  const { data: userRow, error: userRowErr } = await admin
    .from("users")
    .select("tenant_id,role")
    .eq("id", user.id)
    .single();

  if (userRowErr || !userRow) {
    return NextResponse.json({ error: "user_row_missing" }, { status: 400 });
  }
  if (userRow.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const code = crypto.randomUUID();
  const expiresAt =
    parsed.data.expiresInHours != null
      ? new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000).toISOString()
      : null;

  const { error: inviteErr } = await admin.from("tenant_invites").insert({
    code,
    tenant_id: userRow.tenant_id,
    email: parsed.data.email ?? null,
    created_by: user.id,
    expires_at: expiresAt,
  });

  if (inviteErr) {
    console.error("[api/invites] create failed", { requestId, inviteErr });
    return NextResponse.json({ error: "invite_create_failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, code, expires_at: expiresAt }, { status: 200 });
}

