"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex h-12 flex-1 items-center justify-center rounded-2xl text-sm font-semibold",
        active ? "bg-white text-black" : "text-zinc-200",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const showNav = useMemo(() => pathname !== "/", [pathname]);
  const active = useMemo(() => {
    if (pathname?.startsWith("/reports")) return "reports";
    return "home";
  }, [pathname]);

  return (
    <div className="relative min-h-screen bg-black text-white">
      <div className={showNav ? "pb-28" : ""}>{children}</div>

      {showNav ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-black/80 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-xl items-center gap-2">
            <NavLink
              href="/dashboard"
              label="Home"
              active={active === "home"}
            />
            <NavLink
              href="/reports"
              label="Reports"
              active={active === "reports"}
            />
            <button
              onClick={() => setMenuOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700 text-zinc-200 active:scale-[0.99] hidden md:flex"
              aria-label="Menu"
            >
              ☰
            </button>
          </div>
        </div>
      ) : null}

      <BottomSheet
        open={menuOpen}
        title="Menu"
        onClose={() => setMenuOpen(false)}
      >
        <Link
          href="/setup"
          onClick={() => setMenuOpen(false)}
          className="rounded-2xl bg-white px-4 py-4 text-left text-base font-semibold text-black"
        >
          Baby setup
        </Link>
        <a
          href="/api/health"
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left text-base font-semibold text-white"
        >
          Connection health
        </a>
        <div className="pt-1 text-xs text-zinc-400">
          More settings will live here (tenant, invites, baby selector, etc.).
        </div>
      </BottomSheet>
    </div>
  );
}
