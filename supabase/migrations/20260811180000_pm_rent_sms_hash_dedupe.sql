-- SMS paste fraud hardening: content-hash dedupe for pasted M-Pesa confirmations.
-- Receipt unique index already exists; this blocks re-pasting the same SMS body
-- even if receipt parsing varies.

ALTER TABLE public.pm_rent_payments
  ADD COLUMN IF NOT EXISTS sms_content_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_rent_payments_sms_content_hash_unique
  ON public.pm_rent_payments (sms_content_hash)
  WHERE sms_content_hash IS NOT NULL AND length(trim(sms_content_hash)) > 0;

COMMENT ON COLUMN public.pm_rent_payments.sms_content_hash IS
  'SHA-256 of normalized pasted M-Pesa SMS; enforces one-time paste.';
