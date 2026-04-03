"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { BottomSheet } from "@/components/BottomSheet";
import { db } from "@/lib/db";
import { nowIsoUtc } from "@/lib/time";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={active ? "text-black" : "text-zinc-200"}
    >
      <path
        d="M4 10.5 12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 21.5v-7A1.5 1.5 0 0 1 11 13h2a1.5 1.5 0 0 1 1.5 1.5v7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReportsIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={active ? "text-black" : "text-zinc-200"}
    >
      <path
        d="M7 3.5h10A2.5 2.5 0 0 1 19.5 6v14A2.5 2.5 0 0 1 17 22.5H7A2.5 2.5 0 0 1 4.5 20V6A2.5 2.5 0 0 1 7 3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8 8h8M8 12h8M8 16h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={active ? "text-black" : "text-zinc-200"}
    >
      <path
        d="M5 7h14M5 12h14M5 17h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NavLink({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "ripple flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition-colors",
        active
          ? "bg-white/90 text-black"
          : "text-zinc-200 hover:bg-white/10 active:bg-white/15",
      ].join(" ")}
    >
      {icon}
      {label}
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [migrationChecked, setMigrationChecked] = useState(false);

  const onboardingComplete = useLiveQuery(async () => {
    const v = (await db.settings.get("onboarding_complete"))?.value;
    return v === "true";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function migrateIfNeeded() {
      const complete = (await db.settings.get("onboarding_complete"))?.value === "true";
      if (complete) return;

      const eventsCount = await db.events.count();
      const babyId = (await db.settings.get("baby_id"))?.value ?? null;
      const tenantId = (await db.settings.get("tenant_id"))?.value ?? null;
      const userId = (await db.settings.get("user_id"))?.value ?? null;

      const hasLegacyData = eventsCount > 0 || Boolean(babyId && tenantId && userId);
      if (!hasLegacyData) return;

      // Preserve existing local data by completing onboarding in-place.
      const mode = (await db.settings.get("mode"))?.value ?? null;
      if (!mode) {
        await db.settings.put({ key: "mode", value: "offline", updated_at: nowIsoUtc() });
      }

      const role = (await db.settings.get("role"))?.value ?? null;
      if (!role) {
        await db.settings.put({ key: "role", value: "owner", updated_at: nowIsoUtc() });
      }

      const tenantName = (await db.settings.get("tenant_name"))?.value ?? null;
      if (!tenantName) {
        await db.settings.put({
          key: "tenant_name",
          value: "Local family",
          updated_at: nowIsoUtc(),
        });
      }

      // Ensure tenant_id/user_id/baby_id exist using the most recent event if needed.
      if (!tenantId || !userId || !babyId) {
        const events = await db.events.orderBy("start_time").reverse().limit(1).toArray();
        const last = events[0] ?? null;
        if (last) {
          if (!tenantId) {
            await db.settings.put({
              key: "tenant_id",
              value: last.tenant_id,
              updated_at: nowIsoUtc(),
            });
          }
          if (!userId) {
            await db.settings.put({
              key: "user_id",
              value: last.user_id,
              updated_at: nowIsoUtc(),
            });
          }
          if (!babyId) {
            await db.settings.put({
              key: "baby_id",
              value: last.baby_id,
              updated_at: nowIsoUtc(),
            });
          }
        }
      }

      // Ensure a babies list exists (best-effort).
      const babiesRaw = (await db.settings.get("babies"))?.value ?? null;
      if (!babiesRaw) {
        const profileRaw = (await db.settings.get("baby_profile"))?.value ?? null;
        let babies: Array<{ id: string; name: string; birth_date: string }> = [];

        if (profileRaw) {
          try {
            const parsed = JSON.parse(profileRaw) as Record<string, unknown>;
            const id = typeof parsed.id === "string" ? parsed.id : null;
            const name = typeof parsed.name === "string" ? parsed.name : null;
            const birth_date =
              typeof parsed.birth_date === "string" ? parsed.birth_date : null;
            if (id && name && birth_date) {
              babies = [{ id, name, birth_date }];
            }
          } catch {
            // ignore
          }
        }

        if (babies.length === 0 && eventsCount > 0) {
          const events = await db.events.toArray();
          const ids = Array.from(
            new Set(events.map((e) => e.baby_id).filter((v) => typeof v === "string"))
          );
          const today = (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
              d.getDate()
            ).padStart(2, "0")}`;
          })();
          babies = ids.map((id, idx) => ({ id, name: `Baby ${idx + 1}`, birth_date: today }));
        }

        if (babies.length > 0) {
          await db.settings.put({
            key: "babies",
            value: JSON.stringify(babies),
            updated_at: nowIsoUtc(),
          });
        }
      }

      await db.settings.put({
        key: "onboarding_complete",
        value: "true",
        updated_at: nowIsoUtc(),
      });
    }

    void migrateIfNeeded()
      .catch(() => {
        // ignore: never block app load
      })
      .finally(() => {
        if (!cancelled) setMigrationChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!migrationChecked) return;
    if (onboardingComplete === undefined) return;
    if (onboardingComplete) return;
    if (pathname.startsWith("/onboarding")) return;
    if (pathname.startsWith("/auth/callback")) return;
    window.location.replace("/onboarding");
  }, [migrationChecked, onboardingComplete, pathname]);

  const showNav = useMemo(
    () =>
      Boolean(onboardingComplete) &&
      pathname !== "/" &&
      !pathname.startsWith("/onboarding"),
    [pathname, onboardingComplete]
  );
  const active = useMemo(() => {
    if (pathname?.startsWith("/reports")) return "reports";
    return "home";
  }, [pathname]);

  return (
    <div className="relative min-h-screen bg-black text-white">
      <div className={showNav ? "pb-32" : ""}>{children}</div>

      {showNav ? (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <div className="mx-auto w-full max-w-xl">
            <div className="rounded-[28px] border border-white/10 bg-white/10 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="flex items-center gap-2">
            <NavLink
              href="/dashboard"
              label="Home"
              active={active === "home"}
              icon={<HomeIcon active={active === "home"} />}
            />
            <NavLink
              href="/reports"
              label="Reports"
              active={active === "reports"}
              icon={<ReportsIcon active={active === "reports"} />}
            />
            <button
              onClick={() => setMenuOpen(true)}
              className="ripple flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 text-[11px] font-semibold text-zinc-200 transition-colors hover:bg-white/10 active:scale-[0.99] active:bg-white/15"
              aria-label="Menu"
            >
              <MenuIcon active={false} />
              Menu
            </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <BottomSheet
        open={menuOpen}
        title="Menu"
        onClose={() => setMenuOpen(false)}
      >
        <Link
          href="/settings"
          onClick={() => setMenuOpen(false)}
          className="rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
        >
          Settings
        </Link>
        <div className="pt-1 text-xs text-zinc-400">
          More settings will live here (tenant, invites, baby selector, etc.).
        </div>
      </BottomSheet>
    </div>
  );
}
