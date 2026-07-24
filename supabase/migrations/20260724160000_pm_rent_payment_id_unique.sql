-- Harden PM rent payments: one marketplace payment row maps to at most one rent payment
DROP INDEX IF EXISTS public.idx_pm_rent_payments_payment_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_rent_payments_payment_id_unique
  ON public.pm_rent_payments (payment_id)
  WHERE payment_id IS NOT NULL;
