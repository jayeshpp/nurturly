import { db } from "@/lib/db";
import { hasSupabaseEnv } from "@/lib/env";
import { getFeedMeta, setFeedMeta } from "@/lib/event-metadata";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { nowIsoUtc } from "@/lib/time";
import type { EventMetadata, EventType, LocalEvent, MotionKind, FeedSide } from "@/lib/types";

async function getRequiredSetting(key: string) {
  const row = await db.settings.get(key);
  if (!row?.value) throw new Error(`Missing local setting: ${key}`);
  return row.value;
}

export async function setSetting(key: string, value: string) {
  await db.settings.put({ key, value, updated_at: nowIsoUtc() });
}

export async function getContext() {
  const tenant_id = await getRequiredSetting("tenant_id");
  const baby_id = await getRequiredSetting("baby_id");
  const user_id = await getRequiredSetting("user_id");
  return { tenant_id, baby_id, user_id };
}

function newLocalEvent(params: {
  tenant_id: string;
  baby_id: string;
  user_id: string;
  type: EventType;
  start_time: string;
  end_time: string | null;
  metadata: EventMetadata | null;
}): LocalEvent {
  const ts = nowIsoUtc();
  return {
    id: crypto.randomUUID(),
    tenant_id: params.tenant_id,
    baby_id: params.baby_id,
    user_id: params.user_id,
    type: params.type,
    start_time: params.start_time,
    end_time: params.end_time,
    metadata: params.metadata,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    sync_status: "pending",
    last_error: null,
  };
}

async function trySyncEvent(eventId: string) {
  const event = await db.events.get(eventId);
  if (!event) return;
  if (event.sync_status === "synced") return;

  try {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event }),
    });

    if (!res.ok) {
      // If auth isn't ready yet, don't thrash retries / logs.
      if (res.status === 401 || res.status === 403) {
        await db.events.update(eventId, {
          sync_status: "pending",
          last_error: "unauthorized",
          updated_at: nowIsoUtc(),
        });
        return;
      }
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }

    await db.events.update(eventId, {
      sync_status: "synced",
      last_error: null,
      updated_at: nowIsoUtc(),
    });
  } catch (err) {
    await db.events.update(eventId, {
      sync_status: "error",
      last_error: err instanceof Error ? err.message : "sync_failed",
      updated_at: nowIsoUtc(),
    });
  }
}

export async function syncPendingEvents() {
  // If Supabase is configured but the user isn't signed in yet, skip syncing.
  // This prevents repeated 401s while the auth UI isn't implemented/used.
  if (hasSupabaseEnv) {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
  }

  const pending = await db.events
    .where("sync_status")
    .anyOf(["pending", "error"])
    .sortBy("updated_at");
  for (const e of pending) await trySyncEvent(e.id);
}

export async function logPee() {
  const ctx = await getContext();
  const event = newLocalEvent({
    ...ctx,
    type: "pee",
    start_time: nowIsoUtc(),
    end_time: nowIsoUtc(),
    metadata: null,
  });
  await db.events.put(event);
  void trySyncEvent(event.id);
  return event;
}

export async function logMotion(kind: MotionKind) {
  const ctx = await getContext();
  const event = newLocalEvent({
    ...ctx,
    type: "motion",
    start_time: nowIsoUtc(),
    end_time: nowIsoUtc(),
    metadata: { kind },
  });
  await db.events.put(event);
  void trySyncEvent(event.id);
  return event;
}

export async function startFeed() {
  const ctx = await getContext();
  const event = newLocalEvent({
    ...ctx,
    type: "feed",
    start_time: nowIsoUtc(),
    end_time: null,
    metadata: { paused_at: null, paused_total_ms: 0 },
  });
  await db.events.put(event);
  void trySyncEvent(event.id);
  return event;
}

export async function pauseFeed(activeFeedId: string) {
  const feed = await db.events.get(activeFeedId);
  if (!feed || feed.type !== "feed" || feed.end_time !== null || feed.deleted_at !== null) return;

  const { paused_at, paused_total_ms } = getFeedMeta(feed.metadata);
  if (paused_at) return; // already paused

  await db.events.update(activeFeedId, {
    metadata: setFeedMeta(feed.metadata, { paused_at: nowIsoUtc(), paused_total_ms }),
    updated_at: nowIsoUtc(),
    sync_status: "pending",
    last_error: null,
  });
  void trySyncEvent(activeFeedId);
}

export async function resumeFeed(activeFeedId: string) {
  const feed = await db.events.get(activeFeedId);
  if (!feed || feed.type !== "feed" || feed.end_time !== null || feed.deleted_at !== null) return;

  const { paused_at, paused_total_ms } = getFeedMeta(feed.metadata);
  if (!paused_at) return; // not paused

  const delta = Math.max(0, Date.now() - Date.parse(paused_at));
  await db.events.update(activeFeedId, {
    metadata: setFeedMeta(feed.metadata, { paused_at: null, paused_total_ms: paused_total_ms + delta }),
    updated_at: nowIsoUtc(),
    sync_status: "pending",
    last_error: null,
  });
  void trySyncEvent(activeFeedId);
}

export async function endFeed(activeFeedId: string, side?: FeedSide) {
  const end_time = nowIsoUtc();
  const feed = await db.events.get(activeFeedId);
  if (!feed) return;

  // If user ends while paused, accumulate the paused segment up to end_time.
  const { paused_at, paused_total_ms } = getFeedMeta(feed.metadata);
  const extraPaused =
    paused_at ? Math.max(0, Date.parse(end_time) - Date.parse(paused_at)) : 0;

  await db.events.update(activeFeedId, {
    end_time,
    metadata: feed.type === "feed"
      ? setFeedMeta(feed.metadata, {
          side,
          paused_at: null,
          paused_total_ms: paused_total_ms + extraPaused,
        })
      : feed.metadata,
    updated_at: nowIsoUtc(),
    sync_status: "pending",
    last_error: null,
  });
  void trySyncEvent(activeFeedId);
}

export async function setFeedNoteDraft(feedId: string, draft: { note: string; tags: string[] }) {
  const feed = await db.events.get(feedId);
  if (!feed || feed.type !== "feed" || feed.deleted_at !== null) return;

  const note = draft.note.trim();
  const tags = Array.from(new Set(draft.tags.map((t) => t.trim()).filter(Boolean)));

  await db.events.update(feedId, {
    metadata: setFeedMeta(feed.metadata, {
      note: note.length > 0 ? note : undefined,
      note_tags: tags.length > 0 ? tags : undefined,
    }),
    updated_at: nowIsoUtc(),
    sync_status: "pending",
    last_error: null,
  });
  void trySyncEvent(feedId);
}

