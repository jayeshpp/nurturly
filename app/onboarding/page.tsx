"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { extractInviteCode } from "@/lib/invite";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/env";
import { db } from "@/lib/db";
import { nowIsoUtc } from "@/lib/time";
import type { AppMode } from "@/lib/settings";
import { setSetting, setSettingJson } from "@/lib/settings";

type BabyDraft = { id: string; name: string; birth_date: string };

function randomBabyName() {
  const n = Math.floor(Math.random() * 900 + 100);
  return `Baby ${n}`;
}

function todayDateInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

async function writeLocalBabies(babies: BabyDraft[]) {
  const first = babies[0]!;

  await setSetting("baby_id", first.id);
  await db.settings.put({
    key: "baby_profile",
    value: JSON.stringify(first),
    updated_at: nowIsoUtc(),
  });
  await setSettingJson("babies", babies);
}

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const inviteFromUrl = searchParams.get("invite");
  const onboardingComplete = useLiveQuery(async () => {
    const v = (await db.settings.get("onboarding_complete"))?.value;
    return v === "true";
  }, []);

  const [mode, setMode] = useState<AppMode | null>(null);
  const [step, setStep] = useState<
    "mode" | "auth" | "family" | "request_invite" | "babies" | "done"
  >("mode");

  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [familyChoice, setFamilyChoice] = useState<"create" | "join">("create");
  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [babies, setBabies] = useState<BabyDraft[]>(() => [
    { id: crypto.randomUUID(), name: randomBabyName(), birth_date: todayDateInputValue() },
  ]);

  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const sessionUserId = useLiveQuery(async () => {
    if (!hasSupabaseEnv) return null;
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }, [emailSent]);

  useEffect(() => {
    if (onboardingComplete) {
      window.location.href = "/dashboard";
    }
  }, [onboardingComplete]);

  useEffect(() => {
    if (mode === "offline") setStep("babies");
    if (mode === "online") setStep("auth");
  }, [mode]);

  useEffect(() => {
    const start = searchParams.get("start");
    if (!start) return;
    if (mode) return;
    if (start === "online") void chooseMode("online");
    if (start === "offline") void chooseMode("offline");
  }, [searchParams, mode]);

  useEffect(() => {
    if (!inviteFromUrl) return;
    // Invite implies online flow.
    if (!mode) void chooseMode("online");
    setFamilyChoice("join");
    setInviteInput(inviteFromUrl);
  }, [inviteFromUrl]);

  const babiesValid = useMemo(() => {
    return babies.length > 0 && babies.every((b) => b.name.trim().length > 0 && b.birth_date);
  }, [babies]);

  async function chooseMode(next: AppMode) {
    await setSetting("mode", next);
    setMode(next);
  }

  async function sendMagicLink() {
    setAuthError(null);
    setServerError(null);
    if (!hasSupabaseEnv) {
      setAuthError("Supabase is not configured yet.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
    setEmailSent(true);
  }

  async function continueAfterAuth() {
    setAuthError(null);
    if (!sessionUserId) {
      setAuthError("Not signed in yet. Open your magic link to continue.");
      return;
    }
    setStep("family");
  }

  async function completeOffline() {
    setBusy(true);
    setServerError(null);
    try {
      const tenant = (await db.settings.get("tenant_id"))?.value ?? crypto.randomUUID();
      const user = (await db.settings.get("user_id"))?.value ?? crypto.randomUUID();

      await setSetting("tenant_id", tenant);
      await setSetting("user_id", user);
      await setSetting("tenant_name", "Local family");
      await setSetting("role", "owner");
      await writeLocalBabies(babies);
      await setSetting("onboarding_complete", "true");
      setStep("done");
      window.location.href = "/dashboard";
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "offline_setup_failed");
    } finally {
      setBusy(false);
    }
  }

  async function completeOnline() {
    setBusy(true);
    setServerError(null);
    setInviteError(null);
    try {
      if (!sessionUserId) throw new Error("Not signed in.");
      if (!hasSupabaseServiceRoleEnv) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (required for server bootstrap).");
      }

      if (familyChoice === "join") {
        const code = extractInviteCode(inviteInput);
        if (!code) {
          setInviteError("Paste a valid invite link/code.");
          setBusy(false);
          return;
        }
        const res = await fetch("/api/bootstrap", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "join", inviteCode: code }),
        });
        const data: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof data === "object" && data && "error" in data
              ? String((data as { error: unknown }).error)
              : `HTTP ${res.status}`;
          setInviteError(msg);
          setBusy(false);
          return;
        }
        const ok = data as {
          ok: true;
          tenant: { id: string; name: string };
          userId: string;
          babies: Array<{ id: string; name: string; birth_date: string | null }>;
        };

        await setSetting("tenant_id", ok.tenant.id);
        await setSetting("tenant_name", ok.tenant.name);
        await setSetting("user_id", ok.userId);
        await setSetting("role", "member");

        // If tenant has babies, store them locally. Otherwise fall back to draft babies.
        if (ok.babies.length > 0) {
          const localBabies: BabyDraft[] = ok.babies.map((b) => ({
            id: b.id,
            name: b.name,
            birth_date: b.birth_date ?? todayDateInputValue(),
          }));
          await writeLocalBabies(localBabies);
        } else {
          await writeLocalBabies(babies);
        }

        await setSetting("onboarding_complete", "true");
        window.location.href = "/dashboard";
        return;
      }

      // create
      const res = await fetch("/api/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          babies: babies.map((b) => ({ name: b.name.trim(), birth_date: b.birth_date })),
        }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" && data && "error" in data
            ? String((data as { error: unknown }).error)
            : `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const ok = data as {
        ok: true;
        tenant: { id: string; name: string };
        userId: string;
        babies: Array<{ id: string; name: string; birth_date: string | null }>;
      };

      await setSetting("tenant_id", ok.tenant.id);
      await setSetting("tenant_name", ok.tenant.name);
      await setSetting("user_id", ok.userId);
      await setSetting("role", "owner");

      const localBabies: BabyDraft[] = ok.babies.map((b) => ({
        id: b.id,
        name: b.name,
        birth_date: b.birth_date ?? todayDateInputValue(),
      }));
      await writeLocalBabies(localBabies);

      await setSetting("onboarding_complete", "true");
      window.location.href = "/dashboard";
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "online_setup_failed");
    } finally {
      setBusy(false);
    }
  }

  function updateBaby(idx: number, patch: Partial<BabyDraft>) {
    setBabies((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, ...patch } : b))
    );
  }

  function addBaby() {
    setBabies((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: randomBabyName(), birth_date: todayDateInputValue() },
    ]);
  }

  function removeBaby(idx: number) {
    setBabies((prev) => prev.filter((_, i) => i !== idx));
  }

  const requestInviteText = useMemo(() => {
    const e = email.trim() || "<your email>";
    return `Hey — can you invite me to your Nurturly family?\n\nMy email: ${e}\n\nSend me an invite link/code from Nurturly.`;
  }, [email]);

  async function copyRequestInvite() {
    try {
      await navigator.clipboard.writeText(requestInviteText);
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto w-full max-w-xl space-y-5 px-6 py-10">
        <div className="space-y-1">
          <div className="text-xs font-medium tracking-wide text-zinc-400">
            Nurturly
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Onboarding</h1>
          <p className="text-sm text-zinc-400">
            Choose offline-first or online sync. You can switch later.
          </p>
        </div>

        {step === "mode" ? (
          <div className="grid gap-3">
            <button
              onClick={() => void chooseMode("offline")}
              className="ripple rounded-3xl border border-zinc-800 bg-zinc-950 px-5 py-5 text-left"
            >
              <div className="text-lg font-semibold">Offline mode</div>
              <div className="mt-1 text-sm text-zinc-400">
                No account. Data stays on this device. No partner sync.
              </div>
            </button>
            <button
              onClick={() => void chooseMode("online")}
              className="ripple rounded-3xl bg-white px-5 py-5 text-left text-black"
            >
              <div className="text-lg font-semibold">Online sync</div>
              <div className="mt-1 text-sm text-zinc-600">
                Magic link login. Real-time sync with partner. Multi-device.
              </div>
            </button>
          </div>
        ) : null}

        {step === "auth" ? (
          <div className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-sm font-semibold">Sign in (magic link)</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              inputMode="email"
              className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none"
            />
            <button
              disabled={!email.trim() || busy}
              onClick={() => void sendMagicLink()}
              className="ripple w-full rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black disabled:opacity-50"
            >
              Send magic link
            </button>
            {emailSent ? (
              <button
                disabled={busy}
                onClick={() => void continueAfterAuth()}
                className="ripple w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left text-base font-semibold text-white"
              >
                I opened the link — continue
              </button>
            ) : null}
            {authError ? <div className="text-sm text-amber-300">{authError}</div> : null}
            {!hasSupabaseEnv ? (
              <div className="text-xs text-zinc-400">
                Supabase env isn’t set. Add keys in <code>.env.local</code>.
              </div>
            ) : null}
            <button
              onClick={() => {
                setMode(null);
                setStep("mode");
              }}
              className="text-xs font-semibold text-zinc-400 underline"
            >
              Back
            </button>
          </div>
        ) : null}

        {step === "family" ? (
          <div className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-sm font-semibold">Family</div>
            <div className="grid gap-2">
              <button
                onClick={() => {
                  setFamilyChoice("create");
                  setStep("babies");
                }}
                className="ripple rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
              >
                Create new family
              </button>

              <button
                onClick={() => setFamilyChoice("join")}
                className={[
                  "ripple rounded-2xl border px-4 py-4 text-left text-base font-semibold",
                  familyChoice === "join"
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-zinc-700 bg-zinc-950 text-white",
                ].join(" ")}
              >
                Join existing family (invite)
              </button>

              {familyChoice === "join" ? (
                <div className="space-y-2 pt-2">
                  <input
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Paste invite link/code"
                    className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={busy}
                      onClick={() => void completeOnline()}
                      className="ripple rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black disabled:opacity-50"
                    >
                      Join
                    </button>
                    <button
                      onClick={() => setStep("request_invite")}
                      className="ripple rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left text-base font-semibold text-white"
                    >
                      Request invite
                    </button>
                  </div>
                  {inviteError ? (
                    <div className="text-sm text-amber-300">{inviteError}</div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <button
              onClick={() => setStep("auth")}
              className="text-xs font-semibold text-zinc-400 underline"
            >
              Back
            </button>
          </div>
        ) : null}

        {step === "request_invite" ? (
          <div className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-sm font-semibold">Request an invite</div>
            <p className="text-sm text-zinc-400">
              Copy this message and send it to the family owner.
            </p>
            <textarea
              value={requestInviteText}
              readOnly
              rows={5}
              className="w-full resize-none rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => void copyRequestInvite()}
                className="ripple rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
              >
                Copy message
              </button>
              <button
                onClick={() => setStep("family")}
                className="ripple rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left text-base font-semibold text-white"
              >
                Back
              </button>
            </div>
          </div>
        ) : null}

        {step === "babies" ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="text-sm font-semibold">Babies</div>
              <div className="mt-3 grid gap-3">
                {babies.map((b, idx) => (
                  <div key={b.id} className="rounded-3xl border border-zinc-800 bg-black p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-zinc-200">
                        Baby {idx + 1}
                      </div>
                      {babies.length > 1 ? (
                        <button
                          onClick={() => removeBaby(idx)}
                          className="text-xs font-semibold text-zinc-400 underline"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-3">
                      <label className="grid gap-1.5">
                        <span className="text-sm font-medium text-zinc-300">Name</span>
                        <input
                          value={b.name}
                          onChange={(e) => updateBaby(idx, { name: e.target.value })}
                          className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-base text-white outline-none"
                          inputMode="text"
                          autoComplete="off"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-sm font-medium text-zinc-300">Birth date</span>
                        <input
                          type="date"
                          value={b.birth_date}
                          onChange={(e) => updateBaby(idx, { birth_date: e.target.value })}
                          className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-base text-white outline-none"
                        />
                      </label>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => addBaby()}
                  className="ripple rounded-3xl border border-zinc-700 bg-zinc-950 px-5 py-5 text-left text-base font-semibold text-white"
                >
                  + Add another baby
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              {mode === "offline" ? (
                <button
                  disabled={!babiesValid || busy}
                  onClick={() => void completeOffline()}
                  className="ripple w-full rounded-3xl bg-white px-5 py-5 text-left text-base font-semibold text-black disabled:opacity-50"
                >
                  Finish (offline)
                </button>
              ) : (
                <button
                  disabled={!babiesValid || busy}
                  onClick={() => void completeOnline()}
                  className="ripple w-full rounded-3xl bg-white px-5 py-5 text-left text-base font-semibold text-black disabled:opacity-50"
                >
                  Finish (online)
                </button>
              )}

              <button
                onClick={() => {
                  if (mode === "offline") setStep("mode");
                  else setStep("family");
                }}
                className="ripple w-full rounded-3xl border border-zinc-700 bg-zinc-950 px-5 py-5 text-left text-base font-semibold text-white"
              >
                Back
              </button>
            </div>

            {serverError ? <div className="text-sm text-amber-300">{serverError}</div> : null}
            {mode === "online" && !hasSupabaseServiceRoleEnv ? (
              <div className="text-xs text-zinc-400">
                Online bootstrap currently needs <code>SUPABASE_SERVICE_ROLE_KEY</code> set.
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="pt-2 text-xs text-zinc-500">
          <Link href="/" className="underline">
            Back to landing
          </Link>
        </div>
      </main>
    </div>
  );
}

