"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BottomSheet } from "@/components/BottomSheet";
import { db } from "@/lib/db";
import { nowIsoUtc } from "@/lib/time";
import { getSettingJson, setSetting, setSettingJson } from "@/lib/settings";
import type { AppMode } from "@/lib/settings";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/env";

type Baby = { id: string; name: string; birth_date: string };
type Role = "owner" | "member";

function todayDateInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function randomBabyName() {
  const n = Math.floor(Math.random() * 900 + 100);
  return `Baby ${n}`;
}

export default function SettingsPage() {
  const mode = useLiveQuery(async () => {
    return ((await db.settings.get("mode"))?.value as AppMode | undefined) ?? null;
  }, []);

  const tenantId = useLiveQuery(async () => (await db.settings.get("tenant_id"))?.value ?? null, []);
  const tenantName = useLiveQuery(async () => (await db.settings.get("tenant_name"))?.value ?? null, []);
  const userId = useLiveQuery(async () => (await db.settings.get("user_id"))?.value ?? null, []);
  const role = useLiveQuery(async () => {
    return ((await db.settings.get("role"))?.value as Role | undefined) ?? null;
  }, []);
  const activeBabyId = useLiveQuery(async () => (await db.settings.get("baby_id"))?.value ?? null, []);

  const babies = useLiveQuery(async () => {
    return (await getSettingJson<Baby[]>("babies")) ?? [];
  }, []);

  const activeBaby = useMemo(() => {
    if (!babies || !activeBabyId) return null;
    return babies.find((b) => b.id === activeBabyId) ?? null;
  }, [babies, activeBabyId]);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState(() => randomBabyName());
  const [newDob, setNewDob] = useState(() => todayDateInputValue());

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDays, setInviteDays] = useState("7");
  const [inviteResult, setInviteResult] = useState<{ code: string; link: string; expires_at: string | null } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [profileSyncError, setProfileSyncError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncProfile() {
      if (mode !== "online") return;
      if (!hasSupabaseEnv) return;

      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? null;
      if (!token) {
        setProfileSyncError("Not signed in to Supabase yet.");
        return;
      }

      const res = await fetch("/api/me", {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (typeof data === "object" && data && "error" in data) {
          setProfileSyncError(String((data as { error: unknown }).error));
        }
        return;
      }
      if (!(typeof data === "object" && data && "profile" in data)) return;

      const rec = data as Record<string, unknown>;
      const profile = rec.profile as Record<string, unknown> | undefined;
      const user = rec.user as Record<string, unknown> | undefined;

      const tenant_id = profile && typeof profile.tenant_id === "string" ? profile.tenant_id : null;
      const roleVal = profile && (profile.role === "owner" || profile.role === "member") ? (profile.role as Role) : null;
      const tenant_name = profile && typeof profile.tenant_name === "string" ? profile.tenant_name : null;
      const user_id = user && typeof user.id === "string" ? user.id : null;

      if (cancelled) return;

      if (tenant_id) await setSetting("tenant_id", tenant_id);
      if (tenant_name) await setSetting("tenant_name", tenant_name);
      if (roleVal) await setSetting("role", roleVal);
      if (user_id) await setSetting("user_id", user_id);

      setProfileSyncError(null);
    }

    void syncProfile().catch((e) => {
      if (!cancelled) setProfileSyncError(e instanceof Error ? e.message : "profile_sync_failed");
    });

    return () => {
      cancelled = true;
    };
  }, [mode]);

  async function setActiveBaby(baby: Baby) {
    await setSetting("baby_id", baby.id);
    await db.settings.put({
      key: "baby_profile",
      value: JSON.stringify(baby),
      updated_at: nowIsoUtc(),
    });
  }

  async function addBaby() {
    const b: Baby = { id: crypto.randomUUID(), name: newName.trim(), birth_date: newDob };
    if (!b.name) return;
    const next = [...(babies ?? []), b];
    await setSettingJson("babies", next);
    await setActiveBaby(b);
    setAddOpen(false);
  }

  async function goOnlineSync() {
    // We intentionally route through onboarding (not shown in hamburger),
    // so the user can authenticate and choose create/join cleanly.
    window.location.href = "/onboarding?start=online";
  }

  async function signOut() {
    if (!hasSupabaseEnv) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    // After sign out, user will be redirected to onboarding automatically by AppShell guard.
    window.location.href = "/onboarding?start=online";
  }

  function asNumberOrNull(v: string) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  async function createInvite() {
    setInviteError(null);
    setInviteResult(null);

    if (!hasSupabaseEnv) {
      setInviteError("Supabase is not configured.");
      return;
    }
    if (!hasSupabaseServiceRoleEnv) {
      setInviteError("Missing SUPABASE_SERVICE_ROLE_KEY.");
      return;
    }

    const days = asNumberOrNull(inviteDays);
    if (days === null || days <= 0) {
      setInviteError("Enter a valid expiry in days.");
      return;
    }
    const expiresInHours = Math.min(24 * 30, Math.max(1, Math.floor(days * 24)));

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail.trim() ? inviteEmail.trim() : undefined,
        expiresInHours,
      }),
    });

    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        typeof data === "object" && data && "error" in data
          ? String((data as { error: unknown }).error)
          : `HTTP ${res.status}`;
      setInviteError(msg);
      return;
    }

    if (!(typeof data === "object" && data && "code" in data)) {
      setInviteError("Unexpected server response.");
      return;
    }

    const rec = data as Record<string, unknown>;
    const code = String(rec.code);
    const expires_at =
      typeof rec.expires_at === "string" ? String(rec.expires_at) : null;
    const link = `${window.location.origin}/onboarding?start=online&invite=${encodeURIComponent(code)}`;
    setInviteResult({ code, link, expires_at });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto w-full max-w-xl space-y-6 px-6 py-10">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-zinc-400">Profile, babies, sync, tenant.</p>
        </header>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-sm font-semibold">Current profile</div>
          <div className="mt-3 grid gap-2 text-sm text-zinc-300">
            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-400">Mode</div>
              <div className="font-semibold text-zinc-200">{mode ?? "—"}</div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-400">Role</div>
              <div className="font-semibold text-zinc-200">{role ?? "—"}</div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-400">Tenant</div>
              <div className="truncate font-mono text-xs text-zinc-200">
                {tenantId ?? "—"}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-400">Tenant name</div>
              <div className="truncate font-semibold text-zinc-200">
                {tenantName ?? "—"}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-400">User</div>
              <div className="truncate font-mono text-xs text-zinc-200">{userId ?? "—"}</div>
            </div>
          </div>
          {mode === "online" ? (
            <div className="mt-4 grid gap-2">
              <button
                onClick={() => void signOut()}
                className="ripple rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left text-base font-semibold text-white"
              >
                Sign out
              </button>
              {profileSyncError ? (
                <div className="text-xs text-amber-300">{profileSyncError}</div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-sm font-semibold">Babies</div>
          <div className="mt-3 grid gap-2">
            {(babies ?? []).map((b) => {
              const active = b.id === activeBabyId;
              return (
                <button
                  key={b.id}
                  onClick={() => void setActiveBaby(b)}
                  className={[
                    "ripple rounded-2xl border px-4 py-4 text-left",
                    active
                      ? "border-white/20 bg-white/10"
                      : "border-zinc-800 bg-black",
                  ].join(" ")}
                >
                  <div className="text-base font-semibold text-white">{b.name}</div>
                  <div className="mt-1 text-xs text-zinc-400">{b.birth_date}</div>
                </button>
              );
            })}

            <button
              onClick={() => setAddOpen(true)}
              className="ripple rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
            >
              + Add baby
            </button>

            {activeBaby ? (
              <div className="pt-1 text-xs text-zinc-400">
                Active baby: <span className="text-zinc-200">{activeBaby.name}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-sm font-semibold">Online sync</div>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in to sync across devices and with your partner.
          </p>
          <div className="mt-3 grid gap-2">
            {mode === "offline" ? (
              <button
                onClick={() => void goOnlineSync()}
                className="ripple rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
              >
                Enable online sync
              </button>
            ) : (
              <div className="text-sm text-zinc-300">Online mode enabled.</div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-sm font-semibold">Tenant</div>
          <p className="mt-2 text-sm text-zinc-400">Invite partner and manage your family.</p>
          <div className="mt-3 grid gap-2">
            {mode === "online" ? (
              role === "owner" ? (
                <button
                  onClick={() => {
                    setInviteError(null);
                    setInviteResult(null);
                    setInviteOpen(true);
                  }}
                  className="ripple rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
                >
                  Invite partner
                </button>
              ) : (
                <div className="text-sm text-zinc-300">
                  You’re a member. Ask the owner to send you an invite link for new devices.
                </div>
              )
            ) : (
              <div className="text-sm text-zinc-300">
                Offline mode. Enable online sync to invite a partner.
              </div>
            )}
          </div>
        </section>
      </main>

      <BottomSheet open={addOpen} title="Add baby" onClose={() => setAddOpen(false)}>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-zinc-300">Name</span>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none"
            inputMode="text"
            autoComplete="off"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-zinc-300">Birth date</span>
          <input
            type="date"
            value={newDob}
            onChange={(e) => setNewDob(e.target.value)}
            className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none"
          />
        </label>
        <button
          onClick={() => void addBaby()}
          className="ripple rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
        >
          Save
        </button>
      </BottomSheet>

      <BottomSheet
        open={inviteOpen}
        title="Invite partner"
        onClose={() => setInviteOpen(false)}
      >
        <div className="grid gap-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-300">Partner email (optional)</span>
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="partner@example.com"
              inputMode="email"
              className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none"
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-300">Expires (days)</span>
            <input
              value={inviteDays}
              onChange={(e) => setInviteDays(e.target.value)}
              inputMode="numeric"
              className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none"
              autoComplete="off"
            />
          </label>

          <button
            onClick={() => void createInvite()}
            className="ripple rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
          >
            Create invite link
          </button>

          {inviteResult ? (
            <div className="grid gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs font-medium text-zinc-400">Invite code</div>
              <div className="break-all font-mono text-xs text-zinc-200">
                {inviteResult.code}
              </div>
              <div className="text-xs font-medium text-zinc-400">Invite link</div>
              <div className="break-all font-mono text-xs text-zinc-200">
                {inviteResult.link}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => void copy(inviteResult.link)}
                  className="ripple rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
                >
                  Copy link
                </button>
                <button
                  onClick={() => void copy(inviteResult.code)}
                  className="ripple rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left text-base font-semibold text-white"
                >
                  Copy code
                </button>
              </div>
              {inviteResult.expires_at ? (
                <div className="text-xs text-zinc-400">
                  Expires: {new Date(inviteResult.expires_at).toLocaleString()}
                </div>
              ) : null}
            </div>
          ) : null}

          {inviteError ? (
            <div className="text-sm text-amber-300">{inviteError}</div>
          ) : null}
        </div>
      </BottomSheet>
    </div>
  );
}

