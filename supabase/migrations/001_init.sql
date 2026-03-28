-- Nurturly v1 schema (multi-tenant, RLS, UTC timestamps)

create extension if not exists "pgcrypto";

-- Tenants (family)
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Users (app-level profile; maps to auth.users)
create table if not exists public.users (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  display_name text,
  created_at timestamptz not null default now()
);

-- Babies
create table if not exists public.babies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  birth_date date,
  created_at timestamptz not null default now()
);

-- Events (client-generated UUID)
create table if not exists public.events (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  baby_id uuid not null references public.babies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  type text not null check (type in ('feed', 'pee', 'motion')),
  start_time timestamptz not null,
  end_time timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Only one active feed per baby
create unique index if not exists events_one_active_feed_per_baby
  on public.events (baby_id)
  where type = 'feed' and end_time is null and deleted_at is null;

-- Basic updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_events_set_updated_at on public.events;
create trigger trg_events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

-- RLS
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.babies enable row level security;
alter table public.events enable row level security;

-- Helper: current user's tenant_id from public.users
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select tenant_id from public.users where id = auth.uid()
$$;

-- Tenants: allow select only for own tenant (owner/member)
drop policy if exists tenants_select_own on public.tenants;
create policy tenants_select_own
on public.tenants for select
using (id = public.current_tenant_id());

-- Users: allow select within own tenant; allow insert for self only (bootstrap)
drop policy if exists users_select_own_tenant on public.users;
create policy users_select_own_tenant
on public.users for select
using (tenant_id = public.current_tenant_id());

drop policy if exists users_insert_self on public.users;
create policy users_insert_self
on public.users for insert
with check (id = auth.uid());

-- Babies: tenant-scoped
drop policy if exists babies_crud_own_tenant on public.babies;
create policy babies_crud_own_tenant
on public.babies for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

-- Events: tenant-scoped
drop policy if exists events_crud_own_tenant on public.events;
create policy events_crud_own_tenant
on public.events for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

