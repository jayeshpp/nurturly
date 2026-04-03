"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BottomSheet } from "@/components/BottomSheet";
import { db } from "@/lib/db";
import { dayRangeUtcIso, formatDurationMs, formatTimeLocal } from "@/lib/date";
import { getFeedMeta, getMotionMeta } from "@/lib/event-metadata";
import { hapticLight } from "@/lib/haptics";
import { appendFeedNote, setFeedNote } from "@/lib/offline/events";
import type { LocalEvent } from "@/lib/types";

type Tab = "all" | "feed" | "pee" | "motion";

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
  const [tab, setTab] = useState<Tab>("all");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteFeedId, setNoteFeedId] = useState<string | null>(null);

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

  const filteredRows = useMemo(() => {
    if (!rows) return rows;
    if (tab === "all") return rows;
    return rows.filter((e) => e.type === tab);
  }, [rows, tab]);

  const selectedFeed = useMemo(() => {
    if (!rows || !noteFeedId) return null;
    const e = rows.find((r) => r.id === noteFeedId);
    if (!e || e.type !== "feed") return null;
    return e;
  }, [rows, noteFeedId]);

  function openFeedNoteEditor(feed: LocalEvent) {
    if (feed.type !== "feed") return;
    const note = getFeedMeta(feed.metadata).note ?? "";
    setNoteFeedId(feed.id);
    setNoteDraft(note);
    setNoteOpen(true);
  }

  async function onSaveNote() {
    if (!selectedFeed) return;
    hapticLight();
    await setFeedNote(selectedFeed.id, noteDraft);
    setNoteOpen(false);
  }

  async function onQuickNote(snippet: string) {
    if (!selectedFeed) return;
    hapticLight();
    await appendFeedNote(selectedFeed.id, snippet);
    setNoteOpen(false);
  }

  if (!ctx?.baby_id) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="mx-auto w-full max-w-xl space-y-4 px-6 py-12">
          <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-zinc-400">Complete onboarding first.</p>
          <Link
            href="/onboarding"
            className="inline-flex w-full items-center justify-center rounded-3xl bg-white px-5 py-5 text-lg font-semibold text-black"
          >
            Go to onboarding
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
          <div className="border-b border-zinc-800 px-4 py-3">
            <div className="text-sm font-semibold">Events</div>
            <div className="mt-3 flex gap-2">
              <TabButton active={tab === "all"} onClick={() => setTab("all")}>
                All
              </TabButton>
              <TabButton active={tab === "feed"} onClick={() => setTab("feed")}>
                Feed
              </TabButton>
              <TabButton active={tab === "pee"} onClick={() => setTab("pee")}>
                Pee
              </TabButton>
              <TabButton active={tab === "motion"} onClick={() => setTab("motion")}>
                Motion
              </TabButton>
            </div>
          </div>

          <div className="divide-y divide-zinc-900">
            {(filteredRows ?? []).map((e) => (
              <Row key={e.id} e={e} onEditFeedNote={openFeedNoteEditor} />
            ))}
            {filteredRows && filteredRows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-400">
                No {tab === "all" ? "" : `${tab} `}events for this date.
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <BottomSheet
        open={noteOpen}
        title="Feed note"
        onClose={() => setNoteOpen(false)}
      >
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void onQuickNote("Crying")}
              className="rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
            >
              Crying
            </button>
            <button
              onClick={() => void onQuickNote("Fussy")}
              className="rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
            >
              Fussy
            </button>
            <button
              onClick={() => void onQuickNote("Spit up")}
              className="rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
            >
              Spit up
            </button>
            <button
              onClick={() => void onQuickNote("Good latch")}
              className="rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
            >
              Good latch
            </button>
          </div>

          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Optional note…"
            rows={3}
            className="w-full resize-none rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                hapticLight();
                setNoteDraft("");
                if (selectedFeed) void setFeedNote(selectedFeed.id, null);
                setNoteOpen(false);
              }}
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left text-base font-semibold text-white"
            >
              Clear
            </button>
            <button
              onClick={() => void onSaveNote()}
              className="rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
            >
              Save
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "h-10 flex-1 rounded-2xl px-3 text-sm font-semibold",
        active ? "bg-white text-black" : "border border-zinc-700 text-zinc-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Row({
  e,
  onEditFeedNote,
}: {
  e: LocalEvent;
  onEditFeedNote: (feed: LocalEvent) => void;
}) {
  const duration =
    e.end_time && e.type === "feed"
      ? (() => {
          const { paused_total_ms: pausedTotal } = getFeedMeta(e.metadata);
          return Math.max(
            0,
            Date.parse(e.end_time) - Date.parse(e.start_time) - pausedTotal
          );
        })()
      : null;

  const feedMeta = e.type === "feed" ? getFeedMeta(e.metadata) : null;
  const motionMeta = e.type === "motion" ? getMotionMeta(e.metadata) : null;

  const label =
    e.type === "pee"
      ? "Pee"
      : e.type === "motion"
        ? `Motion${motionMeta?.kind ? ` (${motionMeta.kind})` : ""}`
        : `Feed${feedMeta?.side ? ` (${feedMeta.side})` : ""}`;

  return (
    <button
      type="button"
      onClick={() => {
        if (e.type === "feed") onEditFeedNote(e);
      }}
      className={[
        "grid w-full grid-cols-[92px_1fr_90px] items-center gap-3 px-4 py-3 text-left",
        e.type === "feed" ? "active:bg-black/40" : "",
      ].join(" ")}
      aria-label={e.type === "feed" ? "Edit feed note" : undefined}
    >
      <div className="text-sm font-semibold">{formatTimeLocal(e.start_time)}</div>
      <div className="min-w-0">
        <div className="truncate text-sm text-zinc-200">{label}</div>
        {e.type === "feed" && feedMeta?.note ? (
          <div className="truncate text-xs text-zinc-500">{feedMeta.note}</div>
        ) : null}
      </div>
      <div className="text-right text-sm font-semibold text-zinc-300">
        {duration != null ? formatDurationMs(duration) : ""}
      </div>
    </button>
  );
}

