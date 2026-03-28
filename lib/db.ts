import Dexie, { type Table } from "dexie";
import type { LocalEvent, LocalSetting } from "@/lib/types";

class NurturlyDB extends Dexie {
  events!: Table<LocalEvent, string>;
  settings!: Table<LocalSetting, string>;

  constructor() {
    super("nurturly");

    this.version(1).stores({
      events:
        "id, tenant_id, baby_id, user_id, type, start_time, end_time, updated_at, sync_status",
      settings: "key, updated_at",
    });
  }
}

export const db = new NurturlyDB();

