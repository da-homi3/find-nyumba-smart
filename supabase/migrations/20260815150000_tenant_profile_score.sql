create table if not exists public.tenant_search_profiles (
  user_id uuid primary key,
  preferred_locations text not null default '',
  budget_min integer not null default 0,
  budget_max integer not null default 0,
  bedrooms integer not null default 0,
  property_type text not null default '',
  move_in_date text not null default '',
  previous_tenancy text not null default '',
  share_visibility text not null default 'private',
  share_token text unique,
  updated_at timestamptz not null default now()
);

alter table public.tenant_search_profiles enable row level security;

create table if not exists public.contact_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  listing_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.contact_issues enable row level security;
