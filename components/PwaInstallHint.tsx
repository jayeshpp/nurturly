"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { nowIsoUtc } from "@/lib/time";

function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone);
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-white"
    >
      <path
        d="M12 3v11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 6.5 12 3l4 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M7 10.5H6A2.5 2.5 0 0 0 3.5 13v6A2.5 2.5 0 0 0 6 21.5h12A2.5 2.5 0 0 0 20.5 19v-6A2.5 2.5 0 0 0 18 10.5h-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-white"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PwaInstallHint({ appName = "Nurturly" }: { appName?: string }) {
  const dismissed = useLiveQuery(async () => {
    const row = await db.settings.get("pwa_install_hint_dismissed");
    return row?.value === "1";
  }, []);

  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    const update = () => setInstalled(isStandaloneDisplayMode());
    update();

    const mm = window.matchMedia("(display-mode: standalone)");
    mm.addEventListener("change", update);
    return () => {
      mm.removeEventListener("change", update);
    };
  }, []);

  const shouldShow = dismissed === false && installed === false;
  if (!shouldShow) return null;

  async function dismissHint() {
    await db.settings.put({
      key: "pwa_install_hint_dismissed",
      value: "1",
      updated_at: nowIsoUtc(),
    });
  }
  const body = (
    <div className="grid gap-3">
      <div className="grid grid-cols-[24px_1fr] items-center gap-2 text-sm text-zinc-200">
        <ShareIcon />
        <div>Tap <b>Share</b></div>
      </div>
      <div className="grid grid-cols-[24px_1fr] items-center gap-2 text-sm text-zinc-200">
        <PlusIcon />
        <div>Choose <b>Add to Home Screen</b></div>
      </div>
      <div className="text-xs text-zinc-400">
        This will allow you to use {appName} app right from your Home Screen
      </div>
    </div>
  );

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+104px)] z-50 px-4">
      <div className="mx-auto w-full max-w-xl">
        <div className="relative rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => void dismissHint()}
            aria-label="Dismiss"
            className="absolute right-3 top-3 rounded-xl p-2 text-zinc-200 hover:bg-white/10 active:bg-white/15"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div className="pr-10">
            <div className="text-base font-semibold text-white">
              Add to home screen
            </div>
          </div>

          <div className="mt-3">{body}</div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void dismissHint()}
              className="ripple rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
            >
              GOT IT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

