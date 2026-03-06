create table if not exists public.billing_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'premium')),
  source text not null default 'manual',
  effective_from timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_entitlements is 'Server-trusted entitlements used by the AI backend for quota and premium gating.';
comment on column public.billing_entitlements.plan_tier is 'Trusted plan tier. Never sourced from client user_data.';

create index if not exists billing_entitlements_plan_tier_idx
  on public.billing_entitlements (plan_tier);

create index if not exists billing_entitlements_expires_at_idx
  on public.billing_entitlements (expires_at);

alter table public.billing_entitlements enable row level security;

create or replace function public.set_billing_entitlements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_billing_entitlements_updated_at on public.billing_entitlements;

create trigger trg_billing_entitlements_updated_at
before update on public.billing_entitlements
for each row
execute function public.set_billing_entitlements_updated_at();
