"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { setSetting } from "@/lib/offline/events";
import { nowIsoUtc } from "@/lib/time";

function randomName() {
  const n = Math.floor(Math.random() * 900 + 100);
  return `Baby ${n}`;
}

export default function SetupPage() {
  // Deprecated: replaced by /onboarding
  if (typeof window !== "undefined") {
    window.location.href = "/onboarding";
  }
  const existingBabyId = useLiveQuery(async () => {
    const row = await db.settings.get("baby_id");
    return row?.value ?? null;
  }, []);

  const [name, setName] = useState<string>(() => randomName());
  const [birthDate, setBirthDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  });

  const disabled = useMemo(() => !name.trim() || !birthDate, [name, birthDate]);

  async function ensureDemoContext() {
    const tenant = (await db.settings.get("tenant_id"))?.value ?? crypto.randomUUID();
    const user = (await db.settings.get("user_id"))?.value ?? crypto.randomUUID();
    const baby = crypto.randomUUID();

    await setSetting("tenant_id", tenant);
    await setSetting("user_id", user);
    await setSetting("baby_id", baby);

    await db.settings.put({
      key: "baby_profile",
      value: JSON.stringify({ id: baby, name: name.trim(), birth_date: birthDate }),
      updated_at: nowIsoUtc(),
    });
  }

  async function onSave() {
    await ensureDemoContext();
    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto w-full max-w-xl space-y-5 px-6 py-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">First-time setup</h1>
          <p className="text-sm text-zinc-400">
            Add your baby once. Daily logging stays form-free.
          </p>
        </div>

        {existingBabyId ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
            A baby is already set up on this device. You can still overwrite it below.
          </div>
        ) : null}

        <div className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-300">Baby name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none"
              inputMode="text"
              autoComplete="off"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-300">Birth date</span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none"
            />
          </label>
        </div>

        <button
          disabled={disabled}
          onClick={onSave}
          className="w-full rounded-3xl bg-white px-5 py-5 text-lg font-semibold text-black active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
        >
          Save &amp; open dashboard
        </button>

        <p className="text-xs leading-5 text-zinc-500">
          This is demo-mode onboarding (IndexedDB only). Once Supabase is configured, we’ll replace
          this with: magic link → tenant auto-create → user row → baby row.
        </p>
      </main>
    </div>
  );
}

