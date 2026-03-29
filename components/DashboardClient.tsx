"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { BigButton } from "@/components/BigButton";
import { BottomSheet } from "@/components/BottomSheet";
import { db } from "@/lib/db";
import { getFeedMeta } from "@/lib/event-metadata";
import { hapticLight } from "@/lib/haptics";
import {
  appendFeedNote,
  endFeed,
  logMotion,
  logPee,
  pauseFeed,
  resumeFeed,
  setFeedNote,
  startFeed,
  syncPendingEvents,
} from "@/lib/offline/events";
import { dayRangeUtcIso, formatDurationMs } from "@/lib/date";
import type { FeedSide, MotionKind } from "@/lib/types";

function timeAgoShort(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 1) return "just now";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${totalMin}m ago`;
  if (m <= 0) return `${h}h ago`;
  return `${h}h ${m}m ago`;
}

export default function DashboardClient() {
  const [motionOpen, setMotionOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const ctx = useLiveQuery(async () => {
    const tenant_id = (await db.settings.get("tenant_id"))?.value ?? null;
    const baby_id = (await db.settings.get("baby_id"))?.value ?? null;
    const user_id = (await db.settings.get("user_id"))?.value ?? null;
    return { tenant_id, baby_id, user_id };
  }, []);

  const babyProfile = useLiveQuery(async () => {
    const row = await db.settings.get("baby_profile");
    if (!row?.value) return null;
    try {
      return JSON.parse(row.value) as {
        id: string;
        name: string;
        birth_date: string;
      };
    } catch {
      return null;
    }
  }, []);

  const activeFeed = useLiveQuery(async () => {
    if (!ctx?.baby_id) return null;
    const rows = await db.events.where("baby_id").equals(ctx.baby_id).toArray();
    return (
      rows
        .filter(
          (e) =>
            e.type === "feed" && e.deleted_at == null && e.end_time == null,
        )
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .at(-1) ?? null
    );
  }, [ctx?.baby_id]);

  const lastFeed = useLiveQuery(async () => {
    if (!ctx?.baby_id) return null;
    const rows = await db.events.where("baby_id").equals(ctx.baby_id).toArray();
    return (
      rows
        .filter(
          (e) =>
            e.type === "feed" && e.deleted_at == null && e.end_time != null,
        )
        .sort((a, b) => (a.end_time ?? "").localeCompare(b.end_time ?? ""))
        .at(-1) ?? null
    );
  }, [ctx?.baby_id]);

  const todaySummary = useLiveQuery(async () => {
    if (!ctx?.baby_id) return null;
    const { startIso, endIso } = dayRangeUtcIso(new Date());
    const rows = await db.events.where("baby_id").equals(ctx.baby_id).toArray();
    const inDay = rows.filter(
      (e) =>
        e.deleted_at == null &&
        e.start_time >= startIso &&
        e.start_time <= endIso &&
        e.end_time !== null,
    );
    return {
      feed: inDay.filter((e) => e.type === "feed").length,
      pee: inDay.filter((e) => e.type === "pee").length,
      motion: inDay.filter((e) => e.type === "motion").length,
    };
  }, [ctx?.baby_id]);

  const feedRunningMs = useMemo(() => {
    if (!activeFeed) return null;
    const { paused_at: pausedAt, paused_total_ms: pausedTotal } = getFeedMeta(
      activeFeed.metadata
    );
    const endOfSegment = pausedAt ? Date.parse(pausedAt) : nowMs;
    return Math.max(
      0,
      endOfSegment - Date.parse(activeFeed.start_time) - pausedTotal,
    );
  }, [activeFeed, nowMs]);

  const feedIsPaused = useMemo(() => {
    if (!activeFeed) return false;
    const { paused_at } = getFeedMeta(activeFeed.metadata);
    return Boolean(paused_at);
  }, [activeFeed]);

  const activeFeedNote = useMemo(() => {
    if (!activeFeed) return "";
    return getFeedMeta(activeFeed.metadata).note ?? "";
  }, [activeFeed]);

  useEffect(() => {
    void syncPendingEvents();
    const onOnline = () => void syncPendingEvents();
    window.addEventListener("online", onOnline);
    const t = window.setInterval(() => void syncPendingEvents(), 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const intervalMs = activeFeed ? 1000 : 30_000;
    const t = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [Boolean(activeFeed)]);

  if (!ctx?.baby_id) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="mx-auto w-full max-w-xl space-y-4 px-6 py-12">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-400">
            Add a baby once before logging.
          </p>
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

  async function onPee() {
    hapticLight();
    await logPee();
  }

  async function onStartFeed(side: FeedSide) {
    hapticLight();
    if (activeFeed) {
      setFeedOpen(false);
      return;
    }
    await startFeed(side);
    setFeedOpen(false);
  }

  async function onEndFeed() {
    if (!activeFeed) return;
    hapticLight();
    await endFeed(activeFeed.id);
  }

  async function onPauseFeed() {
    if (!activeFeed) return;
    hapticLight();
    await pauseFeed(activeFeed.id);
  }

  async function onResumeFeed() {
    if (!activeFeed) return;
    hapticLight();
    await resumeFeed(activeFeed.id);
  }

  function openNote() {
    if (!activeFeed) return;
    setNoteDraft(activeFeedNote);
    setNoteOpen(true);
  }

  async function onSaveNote() {
    if (!activeFeed) return;
    hapticLight();
    await setFeedNote(activeFeed.id, noteDraft);
    setNoteOpen(false);
  }

  async function onQuickNote(snippet: string) {
    if (!activeFeed) return;
    hapticLight();
    await appendFeedNote(activeFeed.id, snippet);
    setNoteOpen(false);
  }

  async function onMotion(kind: MotionKind) {
    hapticLight();
    await logMotion(kind);
    setMotionOpen(false);
  }

  const lastFeedText = lastFeed
    ? timeAgoShort(nowMs - Date.parse(lastFeed.end_time!))
    : "—";

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto w-full max-w-xl space-y-6 px-6 py-10">
        <header className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium tracking-wide text-zinc-400">
              Nurturly
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {babyProfile?.name ?? "Baby"}
            </h1>
            <div className="text-sm text-zinc-400">
              Last feed: <span className="text-zinc-200">{lastFeedText}</span>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          {activeFeed ? (
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">
                  Active feed
                </div>
                <div className="text-sm text-zinc-400">
                  Running:{" "}
                  <span className="font-semibold text-zinc-200">
                    {formatDurationMs(feedRunningMs ?? 0)}
                  </span>
                </div>
                {feedIsPaused ? (
                  <div className="text-xs font-semibold text-amber-300">
                    Paused
                  </div>
                ) : null}
                {activeFeedNote ? (
                  <div className="text-xs font-medium text-zinc-400">
                    Note:{" "}
                    <span className="text-zinc-200">
                      {activeFeedNote.length > 44
                        ? `${activeFeedNote.slice(0, 44)}…`
                        : activeFeedNote}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openNote}
                  className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
                >
                  Note
                </button>
                {feedIsPaused ? (
                  <button
                    onClick={onResumeFeed}
                    className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={onPauseFeed}
                    className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
                  >
                    Pause
                  </button>
                )}
                <button
                  onClick={onEndFeed}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black active:scale-[0.99]"
                >
                  End
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">
                  No active feed
                </div>
                <div className="text-sm text-zinc-400">
                  Tap start when feeding begins.
                </div>
              </div>
              <button
                onClick={() => setFeedOpen(true)}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black active:scale-[0.99]"
              >
                Start feed
              </button>
            </div>
          )}
        </section>

        <section className="grid gap-3">
          <BigButton label="💧 Pee" subLabel="1 tap" onClick={onPee} />

          <BigButton
            label="💩 Motion"
            subLabel="1–2 taps"
            onClick={() => setMotionOpen(true)}
          />

          <BigButton
            label={activeFeed ? "🛑 End Feed" : "🍼 Start Feed"}
            subLabel={activeFeed ? "tap to stop" : "choose side"}
            onClick={() => (activeFeed ? void onEndFeed() : setFeedOpen(true))}
          />
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-sm font-semibold text-white">Today</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-black px-3 py-3">
              <div className="text-2xl font-semibold">
                {todaySummary?.feed ?? "—"}
              </div>
              <div className="text-xs font-medium text-zinc-400">feeds</div>
            </div>
            <div className="rounded-2xl bg-black px-3 py-3">
              <div className="text-2xl font-semibold">
                {todaySummary?.pee ?? "—"}
              </div>
              <div className="text-xs font-medium text-zinc-400">pee</div>
            </div>
            <div className="rounded-2xl bg-black px-3 py-3">
              <div className="text-2xl font-semibold">
                {todaySummary?.motion ?? "—"}
              </div>
              <div className="text-xs font-medium text-zinc-400">motion</div>
            </div>
          </div>
        </section>
      </main>

      <BottomSheet
        open={motionOpen}
        title="Motion"
        onClose={() => setMotionOpen(false)}
      >
        <button
          onClick={() => void onMotion("normal")}
          className="rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
        >
          Normal
        </button>
        <button
          onClick={() => void onMotion("liquid")}
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left text-base font-semibold text-white"
        >
          Liquid
        </button>
        <button
          onClick={() => void onMotion("hard")}
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left text-base font-semibold text-white"
        >
          Hard
        </button>
      </BottomSheet>

      <BottomSheet
        open={feedOpen}
        title="Start feed"
        onClose={() => setFeedOpen(false)}
      >
        <button
          disabled={Boolean(activeFeed)}
          onClick={() => void onStartFeed("left")}
          className="rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black disabled:opacity-40"
        >
          Left
        </button>
        <button
          disabled={Boolean(activeFeed)}
          onClick={() => void onStartFeed("right")}
          className="rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black disabled:opacity-40"
        >
          Right
        </button>
        <button
          disabled={Boolean(activeFeed)}
          onClick={() => void onStartFeed("both")}
          className="rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black disabled:opacity-40"
        >
          Both
        </button>
        {activeFeed ? (
          <div className="pt-1 text-xs text-zinc-400">
            You already have an active feed. End it first.
          </div>
        ) : null}
      </BottomSheet>

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
                setNoteDraft("");
                if (activeFeed) void setFeedNote(activeFeed.id, null);
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
