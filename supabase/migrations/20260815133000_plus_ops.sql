-- Plus ops: AI usage, contact-credit ledger, financial partner catalog (empty until configured).

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  feature text not null,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);

alter table public.ai_usage_events enable row level security;

create table if not exists public.contact_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  delta integer not null,
  remaining integer,
  reason text not null,
  listing_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists contact_credit_ledger_user_created_idx
  on public.contact_credit_ledger (user_id, created_at desc);

alter table public.contact_credit_ledger enable row level security;

create table if not exists public.financial_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product text not null,
  status text not null default 'inactive',
  application_url text,
  disclosure text,
  created_at timestamptz not null default now()
);

alter table public.financial_partners enable row level security;
