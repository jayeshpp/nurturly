import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/env";

type Role = "owner" | "member";

function getBearerToken(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function GET(request: Request) {
  if (!hasSupabaseEnv) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 400 });
  }
  if (!hasSupabaseServiceRoleEnv) {
    return NextResponse.json({ error: "missing_service_role_key" }, { status: 500 });
  }

  const admin = createSupabaseAdminClient();
  const token = getBearerToken(request);

  let authedUserId: string | null = null;
  let authedEmail: string | null = null;

  if (token) {
    const { data, error } = await admin.auth.getUser(token);
    if (!error && data.user) {
      authedUserId = data.user.id;
      authedEmail = data.user.email ?? null;
    }
  }

  if (!authedUserId) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    authedUserId = user.id;
    authedEmail = user.email ?? null;
  }

  const { data, error } = await admin
    .from("users")
    .select("tenant_id, role, tenants(name)")
    .eq("id", authedUserId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "profile_missing" }, { status: 400 });
  }

  const rec = data as unknown as {
    tenant_id: string;
    role: Role;
    tenants: { name: string } | null;
  };

  return NextResponse.json(
    {
      ok: true,
      user: { id: authedUserId, email: authedEmail },
      profile: {
        tenant_id: rec.tenant_id,
        role: rec.role,
        tenant_name: rec.tenants?.name ?? null,
      },
    },
    { status: 200 }
  );
}

