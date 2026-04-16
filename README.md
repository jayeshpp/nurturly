# Nurturly

**One-liner:** an offline-first, 1–2 tap baby tracker that turns chaotic newborn days into clear, shareable timelines.

**Live demo:** `https://nurturly.vercel.app/`  
**Tagline:** Because 3AM should be simple.

When my baby was a newborn (now ~2.5 months), feeding was… intense. My wife had an overactive letdown, the baby cried through feeds, and we were trying to keep track of everything: feeds, pee, motion, timing, notes. The “system” became an Excel sheet — accurate, but painful. Half-asleep, one hand holding a baby, the other trying to find the right row and type a timestamp.

Nurturly is what I wished we had: a **PWA designed for sleepy parents**, with **minimal taps**, **high-contrast UI**, and **offline-first reliability** — plus a scalable path to multi-device sync for partners.

## Why this matters

Newborn care is full of micro-decisions driven by timing (“When was the last feed?”, “How long has it been?”, “Was that a small motion or a lot?”). Logging shouldn’t be a chore — it should be as effortless as a reflex, so the data is there when you actually need it.

## What it does (MVP)

- **Ultra low-friction logging**: big buttons, minimal text, designed for 3am.
- **Offline-first by default**: logs work with no internet (IndexedDB), then sync when online.
- **Feeds with real duration**: start/pause/resume/end with side selection at end.
- **Motion + pee**: single tap, plus motion details (**type** + **amount**).
- **Notes that stay visible**: no truncation; notes can be added during a feed and edited later in Reports.
- **Reports that answer questions fast**: daily timeline + filters per event type.

## Product direction (investor-friendly)

Nurturly is built as a **multi-tenant foundation** (family/household) with **row-level security**, designed to grow into:
- **Partner real-time sync** (shared timeline across devices)
- **Invite + onboarding** (create/join a family, baby switcher)
- **Insights** (patterns, trends, gentle prompts — without turning parenting into a spreadsheet)

## Tech highlights

- **Next.js App Router + TypeScript**
- **PWA** (installable, fast, offline-capable)
- **IndexedDB (Dexie)** for local-first storage + optimistic UI
- **Supabase** (Auth + Postgres + RLS + Realtime-ready)
- **UTC timestamps** and data model built for multi-tenant SaaS

## Try it

You can explore the MVP in **demo mode**:
- Open [app](https://nurturly.vercel.app/)
- Go to **First-time setup**
- Start logging immediately (offline-first; no Supabase required to try the flow)

## Screens / demo flow

If you’re demoing Nurturly (or pitching it), this is the 60-second flow:

1) **Open the app (offline works)** → the dashboard is instantly usable.
2) **Tap “Start feed”** → timer starts immediately (no forms, no friction).
3) **Pause / resume** mid-feed if needed (real-world interruptions happen).
4) **Add a note** (“crying during letdown”, “great latch”, etc.) while feeding.
5) **End feed** → pick **Left / Right / Both** with one quick choice.
6) **Log Pee** with a single tap.
7) **Log Motion** → pick **amount** (Small/Medium/Large) + **type** (Normal/Liquid/Hard).
8) **Open Reports** → see a clean daily timeline + filters (Feed/Pee/Motion), and edit notes later.

### Screenshots

- `docs/screens/dashboard.png`
- `docs/screens/motion.png`
- `docs/screens/reports.png`

## Getting started (local dev)

Run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase configuration (recommended)

This project follows Supabase’s Next.js quickstart for environment variables and SSR cookie-based auth:
- `https://supabase.com/docs/guides/getting-started/quickstarts/nextjs`

1) Copy env template:

```bash
cp .env.example .env.local
```

2) Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred) or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- (Optional) `SUPABASE_SERVICE_ROLE_KEY` for `/api/health` DB checks and admin routes

3) Verify connectivity:
- Open `http://localhost:3000/api/health`

## Database schema

MVP tables + RLS policies live in `supabase/migrations/001_init.sql`. Apply it in the Supabase SQL editor to create:
- `tenants`, `users`, `babies`, `events`
- RLS tenant isolation
- Unique “one active feed per baby” constraint

Invites live in `supabase/migrations/002_invites.sql` (`tenant_invites` table).

## Deploy

Nurturly is a Next.js app and deploys cleanly to Vercel. Ensure environment variables are set the same as `.env.local` in your Vercel project settings.
