export type EventType = "feed" | "pee" | "motion";

export type MotionKind = "liquid" | "normal" | "hard";
export type FeedSide = "left" | "right" | "both";

export type EventMetadata =
  | {
      side?: FeedSide;
      paused_at?: string | null;
      paused_total_ms?: number;
      note?: string;
    }
  | { kind?: MotionKind }
  | Record<string, unknown>;

export type LocalSyncStatus = "pending" | "synced" | "error";

export type EventRow = {
  id: string; // client-generated UUID
  tenant_id: string;
  baby_id: string;
  user_id: string;
  type: EventType;
  start_time: string; // ISO string in UTC
  end_time: string | null; // ISO string in UTC
  metadata: EventMetadata | null;
  created_at: string; // ISO string in UTC
  updated_at: string; // ISO string in UTC
  deleted_at: string | null; // ISO string in UTC
};

export type LocalEvent = EventRow & {
  sync_status: LocalSyncStatus;
  last_error: string | null;
};

export type LocalSetting = {
  key: string;
  value: string;
  updated_at: string;
};

