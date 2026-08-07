-- Allow PM rent STK + PM module purchases on public.payments
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_type_check CHECK (
    payment_type IN (
      'featured_listing',
      'premium_subscription',
      'property_boost',
      'tenant_plus',
      'lead_pack',
      'verification',
      'report',
      'invoice',
      'landlord_plan',
      'contact_unlock',
      'provider_subscription',
      'rent_payment',
      'pm_module'
    )
  );
