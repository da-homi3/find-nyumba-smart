-- Admin override for per-account active listing caps (landlord, agency, manager).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_listing_limit_override INTEGER;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_admin_listing_limit_override_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_admin_listing_limit_override_check
  CHECK (
    admin_listing_limit_override IS NULL
    OR (admin_listing_limit_override >= 0 AND admin_listing_limit_override <= 9999)
  );

COMMENT ON COLUMN public.profiles.admin_listing_limit_override IS
  'When set, replaces plan-based listing cap for this account. NULL uses plan + bonus slots.';
