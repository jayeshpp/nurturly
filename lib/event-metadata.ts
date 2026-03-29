import type { EventMetadata, FeedSide, MotionKind } from "@/lib/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export type FeedMeta = {
  side?: FeedSide;
  paused_at: string | null;
  paused_total_ms: number;
  note?: string;
};

export type MotionMeta = {
  kind?: MotionKind;
};

export function getFeedMeta(metadata: EventMetadata | null | undefined): FeedMeta {
  const m = asRecord(metadata);
  const side = typeof m.side === "string" ? (m.side as FeedSide) : undefined;
  const paused_at = typeof m.paused_at === "string" ? m.paused_at : null;
  const paused_total_ms = typeof m.paused_total_ms === "number" ? m.paused_total_ms : 0;
  const note = typeof m.note === "string" ? m.note : undefined;

  return { side, paused_at, paused_total_ms, note };
}

export function setFeedMeta(
  metadata: EventMetadata | null | undefined,
  patch: Partial<Pick<FeedMeta, "paused_at" | "paused_total_ms" | "note">>
): EventMetadata {
  const base = asRecord(metadata);
  const next: Record<string, unknown> = { ...base };

  if ("paused_at" in patch) next.paused_at = patch.paused_at ?? null;
  if ("paused_total_ms" in patch) next.paused_total_ms = patch.paused_total_ms ?? 0;
  if ("note" in patch) next.note = patch.note;

  return next;
}

export function getMotionMeta(metadata: EventMetadata | null | undefined): MotionMeta {
  const m = asRecord(metadata);
  const kind = typeof m.kind === "string" ? (m.kind as MotionKind) : undefined;
  return { kind };
}

