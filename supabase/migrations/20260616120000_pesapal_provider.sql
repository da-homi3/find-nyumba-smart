-- Pesapal webhook provider + drop unused Paystack column

ALTER TABLE public.payment_webhook_log
  DROP CONSTRAINT IF EXISTS payment_webhook_log_provider_check;

ALTER TABLE public.payment_webhook_log
  ADD CONSTRAINT payment_webhook_log_provider_check
  CHECK (provider IN ('mpesa', 'pesapal', 'paystack', 'flutterwave'));

ALTER TABLE public.subscriptions
  DROP COLUMN IF EXISTS paystack_auth_code;
