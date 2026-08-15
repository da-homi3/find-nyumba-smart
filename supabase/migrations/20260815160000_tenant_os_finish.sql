create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

insert into public.platform_settings (key, value)
values (
  'tenant_plus_pricing',
  '{"monthlyKes":700,"quarterlyKes":1800,"quarterlyRegularKes":2100,"contactCreditsPerMonth":10}'::jsonb
)
on conflict (key) do nothing;

create table if not exists public.tenant_score_rules (
  id text primary key,
  name text not null,
  description text not null default '',
  points integer not null,
  category text not null,
  enabled boolean not null default true,
  tenant_visibility boolean not null default true,
  landlord_visibility boolean not null default true
);

alter table public.tenant_score_rules enable row level security;

insert into public.tenant_score_rules (id, name, description, points, category)
values
  ('phone', 'Phone verified', 'Approved phone verification', 10, 'verified'),
  ('email', 'Email verified', 'Confirmed email on the account', 10, 'verified'),
  ('identity', 'Identity verified', 'Approved identity verification', 20, 'verified'),
  ('employment', 'Employment verified', 'Approved employment verification', 15, 'verified'),
  ('income', 'Income verified', 'Approved income verification', 15, 'verified'),
  ('tenancy', 'Previous tenancy', 'Previous tenancy notes provided', 10, 'complete'),
  ('locations', 'Preferred locations', 'At least one preferred area', 5, 'complete'),
  ('budget', 'Budget confirmed', 'Budget range saved', 5, 'complete'),
  ('move_in', 'Move-in date', 'Target move-in date saved', 5, 'complete'),
  ('profile', 'Profile completed', 'Name and phone on profile', 5, 'complete')
on conflict (id) do nothing;

create table if not exists public.tenant_score_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  percent integer not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.tenant_score_history enable row level security;

create index if not exists tenant_score_history_user_idx
  on public.tenant_score_history (user_id, created_at desc);

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.product_events enable row level security;

create index if not exists product_events_name_idx
  on public.product_events (event_name, created_at desc);

alter table public.verifications
  add column if not exists expires_at timestamptz;
