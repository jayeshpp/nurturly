-- Tenant invites (invite-code join)

create table if not exists public.tenant_invites (
  code uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  redeemed_by uuid references public.users(id) on delete set null,
  redeemed_at timestamptz,
  expires_at timestamptz
);

alter table public.tenant_invites enable row level security;

-- For now, we use service role via API routes for invite creation/redeem.
-- (Can be tightened later with owner-only policies.)

