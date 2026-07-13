-- Flexible pricing: sale, lease/rent, or short-term booking with period units.
CREATE TYPE public.pricing_mode AS ENUM ('rent', 'sale', 'booking');
CREATE TYPE public.price_period AS ENUM ('night', 'week', 'month');

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS pricing_mode public.pricing_mode NOT NULL DEFAULT 'rent';

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS price_period public.price_period;

-- Backfill booking types (BnB / hotel) and keep residential on monthly rent.
UPDATE public.properties
SET
  pricing_mode = 'booking',
  price_period = COALESCE(price_period, 'night'::public.price_period)
WHERE property_type IN ('bnb', 'hotel')
  AND pricing_mode = 'rent';

UPDATE public.properties
SET price_period = COALESCE(price_period, 'month'::public.price_period)
WHERE pricing_mode IN ('rent', 'booking')
  AND price_period IS NULL;

COMMENT ON COLUMN public.properties.pricing_mode IS
  'How the listing is priced: monthly lease (rent), one-time sale, or short-term booking.';

COMMENT ON COLUMN public.properties.price_period IS
  'Billing unit for rent/booking prices — night, week, or month. Null for sale listings.';
