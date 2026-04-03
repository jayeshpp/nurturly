import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-8 px-6 py-12">
        <div className="space-y-2">
          <div className="text-sm font-medium tracking-wide text-zinc-400">
            Nurturly
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Because 3AM should be simple.
          </h1>
          <p className="text-lg leading-7 text-zinc-300">
            One‑tap logging for feeds, pee, and motion. Offline-first. Syncs with
            your partner.
          </p>
        </div>

        <div className="grid gap-3">
          <Link
            href="/dashboard"
            className="rounded-2xl bg-white px-5 py-4 text-center text-lg font-semibold text-black active:scale-[0.99]"
          >
            Open Dashboard
          </Link>
          <Link
            href="/onboarding"
            className="rounded-2xl border border-zinc-700 px-5 py-4 text-center text-base font-semibold text-white active:scale-[0.99]"
          >
            Get started
          </Link>
        </div>

        <p className="text-xs leading-5 text-zinc-500">
          MVP note: You can run in “demo mode” without Supabase configured; once
          you add Supabase env vars, API writes + realtime will activate.
        </p>
      </main>
    </div>
  );
}
