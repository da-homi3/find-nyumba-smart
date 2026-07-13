-- BnB, hotel, villa categories + minimum lease term for commercial listings.
ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'bnb';
ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'hotel';
ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'villa';

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS minimum_rent_period_months integer;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_minimum_rent_period_months_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_minimum_rent_period_months_check
  CHECK (minimum_rent_period_months IS NULL OR minimum_rent_period_months >= 1);

COMMENT ON COLUMN public.properties.minimum_rent_period_months IS
  'Minimum lease length in months — used for commercial listings.';
