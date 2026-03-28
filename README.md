Nurturly is an offline-first, multi-tenant baby activity tracker (Next.js App Router + PWA + Supabase).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Supabase configuration (recommended)

This project follows Supabase’s Next.js quickstart for environment variables and SSR cookie-based auth.
See: `https://supabase.com/docs/guides/getting-started/quickstarts/nextjs`

1. Copy env template:

```bash
cp .env.example .env.local
```

2. Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred) or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- (Optional) `SUPABASE_SERVICE_ROLE_KEY` for `/api/health` DB checks

3. Verify connectivity:
- Open `http://localhost:3000/api/health`

### Database schema

MVP tables + RLS policies live in `supabase/migrations/001_init.sql`.
Paste it into your Supabase SQL editor to create:
- `tenants`, `users`, `babies`, `events`
- RLS tenant isolation
- unique “one active feed per baby” constraint

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
