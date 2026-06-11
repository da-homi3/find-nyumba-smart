-- M-Pesa checkout tracking + saved search criteria column

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS mpesa_checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS mpesa_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_checkout ON public.payments(mpesa_checkout_id)
  WHERE mpesa_checkout_id IS NOT NULL;

ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS criteria JSONB NOT NULL DEFAULT '{}';

UPDATE public.saved_searches
SET criteria = filters
WHERE criteria = '{}'::jsonb AND filters IS NOT NULL;
