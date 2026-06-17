-- Paystack subscription renewal fields + webhook provider

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paystack_auth_code TEXT,
  ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMPTZ;

ALTER TABLE public.payment_webhook_log
  DROP CONSTRAINT IF EXISTS payment_webhook_log_provider_check;

ALTER TABLE public.payment_webhook_log
  ADD CONSTRAINT payment_webhook_log_provider_check
  CHECK (provider IN ('mpesa', 'paystack', 'flutterwave'));
