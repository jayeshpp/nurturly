"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { dayRangeUtcIso, formatDurationMs, formatTimeLocal } from "@/lib/date";
import type { LocalEvent } from "@/lib/types";

function avg(nums: number[]) {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function ReportsClient() {
  const [dateValue, setDateValue] = useState(() => toDateInputValue(new Date()));

  const ctx = useLiveQuery(async () => {
    const baby_id = (await db.settings.get("baby_id"))?.value ?? null;
    return { baby_id };
  }, []);

  const date = useMemo(() => {
    const [y, m, d] = dateValue.split("-").map((x) => Number(x));
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }, [dateValue]);

  const rows = useLiveQuery(async () => {
    if (!ctx?.baby_id) return null;
    const { startIso, endIso } = dayRangeUtcIso(date);
    const all = await db.events.where("baby_id").equals(ctx.baby_id).toArray();
    return all
      .filter((e) => e.deleted_at == null && e.start_time >= startIso && e.start_time <= endIso)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [ctx?.baby_id, dateValue]);

  const summary = useMemo(() => {
    if (!rows) return null;
    const complete = rows.filter((e) => e.end_time != null);
    const feeds = complete.filter((e) => e.type === "feed");
    const pees = complete.filter((e) => e.type === "pee");
    const motions = complete.filter((e) => e.type === "motion");

    const feedDurations = feeds
      .map((e) => Date.parse(e.end_time!) - Date.parse(e.start_time))
      .filter((n) => Number.isFinite(n) && n >= 0);

    const feedStarts = feeds
      .map((e) => Date.parse(e.start_time))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    const intervals: number[] = [];
    for (let i = 1; i < feedStarts.length; i++) intervals.push(feedStarts[i]! - feedStarts[i - 1]!);

    return {
      totalFeeds: feeds.length,
      avgFeedDurationMs: avg(feedDurations),
      avgIntervalMs: avg(intervals),
      peeCount: pees.length,
      motionCount: motions.length,
    };
  }, [rows]);

  if (!ctx?.baby_id) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="mx-auto w-full max-w-xl space-y-4 px-6 py-12">
          <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-zinc-400">Set up a baby first.</p>
          <Link
            href="/setup"
            className="inline-flex w-full items-center justify-center rounded-3xl bg-white px-5 py-5 text-lg font-semibold text-black"
          >
            Go to setup
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto w-full max-w-xl space-y-6 px-6 py-10">
        <header className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
            <p className="text-sm text-zinc-400">Daily view</p>
          </div>
        </header>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-zinc-300">Date</span>
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none"
            />
          </label>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-xs font-medium text-zinc-400">Total feeds</div>
            <div className="mt-1 text-3xl font-semibold">{summary?.totalFeeds ?? "—"}</div>
          </div>
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-xs font-medium text-zinc-400">Avg duration</div>
            <div className="mt-1 text-3xl font-semibold">
              {summary?.avgFeedDurationMs != null ? formatDurationMs(summary.avgFeedDurationMs) : "—"}
            </div>
          </div>
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-xs font-medium text-zinc-400">Avg interval</div>
            <div className="mt-1 text-3xl font-semibold">
              {summary?.avgIntervalMs != null ? formatDurationMs(summary.avgIntervalMs) : "—"}
            </div>
          </div>
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-xs font-medium text-zinc-400">Pee / Motion</div>
            <div className="mt-1 text-3xl font-semibold">
              {summary ? `${summary.peeCount} / ${summary.motionCount}` : "—"}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold">
            Events
          </div>

          <div className="divide-y divide-zinc-900">
            {(rows ?? []).map((e) => (
              <Row key={e.id} e={e} />
            ))}
            {rows && rows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-400">No events for this date.</div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

function Row({ e }: { e: LocalEvent }) {
  const duration =
    e.end_time && e.type === "feed"
      ? Date.parse(e.end_time) - Date.parse(e.start_time)
      : null;

  const label =
    e.type === "pee"
      ? "Pee"
      : e.type === "motion"
        ? `Motion${typeof e.metadata === "object" && e.metadata && "kind" in e.metadata ? ` (${String((e.metadata as any).kind)})` : ""}`
        : `Feed${typeof e.metadata === "object" && e.metadata && "side" in e.metadata ? ` (${String((e.metadata as any).side)})` : ""}`;

  return (
    <div className="grid grid-cols-[92px_1fr_90px] items-center gap-3 px-4 py-3">
      <div className="text-sm font-semibold">{formatTimeLocal(e.start_time)}</div>
      <div className="text-sm text-zinc-200">{label}</div>
      <div className="text-right text-sm font-semibold text-zinc-300">
        {duration != null ? formatDurationMs(duration) : ""}
      </div>
    </div>
  );
}

