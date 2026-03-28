import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import type { EventRow } from "@/lib/types";

const BodySchema = z.object({
  event: z.custom<EventRow>(),
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { event } = parsed.data;

  // Demo-mode: accept writes so offline sync can mark as "synced".
  // Once Supabase env vars are set, we enforce auth + write to Postgres.
  if (!hasSupabaseEnv) {
    return NextResponse.json({ ok: true, mode: "demo" }, { status: 200 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    if (userErr) {
      console.warn("[api/events] auth.getUser failed", {
        requestId,
        message: userErr.message,
      });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Hard guard: client must not spoof user_id.
  if (event.user_id !== user.id) {
    return NextResponse.json({ error: "user_mismatch" }, { status: 403 });
  }

  // RLS should enforce tenant isolation. We still validate required shape here.
  const insertable = {
    id: event.id,
    tenant_id: event.tenant_id,
    baby_id: event.baby_id,
    user_id: event.user_id,
    type: event.type,
    start_time: event.start_time,
    end_time: event.end_time,
    metadata: event.metadata,
    deleted_at: event.deleted_at,
    created_at: event.created_at,
    updated_at: event.updated_at,
  };

  const { error } = await supabase
    .from("events")
    .upsert(insertable, { onConflict: "id" });

  if (error) {
    console.error("[api/events] db upsert failed", {
      requestId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json({ error: "db_error", details: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

