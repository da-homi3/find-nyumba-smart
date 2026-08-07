-- Allow listing prices to be entered in USD while keeping rent_kes as system-of-record
-- for search filters, unlock fees, and KES payments.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS price_currency text NOT NULL DEFAULT 'KES';

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_price_currency_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_price_currency_check
  CHECK (price_currency IN ('KES', 'USD'));

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS rent_usd numeric(12, 2);

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS rent_usd_max numeric(12, 2);

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS deposit_usd numeric(12, 2);

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_rent_usd_max_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_rent_usd_max_check
  CHECK (rent_usd_max IS NULL OR rent_usd IS NULL OR rent_usd_max >= rent_usd);

COMMENT ON COLUMN public.properties.price_currency IS
  'Display/entry currency for the listing price (KES or USD). rent_kes remains canonical for filters and fees.';

COMMENT ON COLUMN public.properties.rent_usd IS
  'Optional USD amount when price_currency = USD. rent_kes is the converted KES equivalent.';
