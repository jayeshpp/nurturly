import { NextResponse } from "next/server";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const started = Date.now();
  const requestId = crypto.randomUUID();

  if (!hasSupabaseEnv) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        supabase: { configured: false, serviceRoleConfigured: false },
        db: { connected: false, reason: "missing_supabase_env" },
        time: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  if (!hasSupabaseServiceRoleEnv) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        supabase: { configured: true, serviceRoleConfigured: false },
        db: {
          connected: false,
          reason: "missing_service_role_key",
          note: "Set SUPABASE_SERVICE_ROLE_KEY to enable server-side connectivity check.",
        },
        time: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    // A tiny query that proves PostgREST can talk to Postgres.
    // If tables aren't migrated yet, you'll get a schema error (still connectivity).
    const { error } = await supabase.from("tenants").select("id").limit(1);

    const latencyMs = Date.now() - started;

    if (error) {
      const schemaMissing = error.code === "42P01"; // undefined_table
      console.warn("[api/health] db check error", {
        requestId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      return NextResponse.json(
        {
          ok: schemaMissing, // connectivity is fine; schema may not be.
          requestId,
          supabase: { configured: true, serviceRoleConfigured: true },
          db: {
            connected: true,
            latencyMs,
            schemaReady: !schemaMissing,
            error: {
              code: error.code,
              message: error.message,
            },
          },
          time: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        supabase: { configured: true, serviceRoleConfigured: true },
        db: { connected: true, latencyMs, schemaReady: true },
        time: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    const latencyMs = Date.now() - started;
    console.error("[api/health] unexpected error", { requestId, err });
    return NextResponse.json(
      {
        ok: false,
        requestId,
        supabase: { configured: true, serviceRoleConfigured: true },
        db: {
          connected: false,
          latencyMs,
          reason: err instanceof Error ? err.message : "unknown_error",
        },
        time: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}

