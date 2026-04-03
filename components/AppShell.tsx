"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

  const showNav = useMemo(() => pathname !== "/", [pathname]);
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
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
