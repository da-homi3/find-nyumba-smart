-- Performance indexes + search_events table for sales automation analytics.

CREATE TABLE IF NOT EXISTS search_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  query text,
  neighborhood text,
  result_count int,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE search_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role search_events" ON search_events;
CREATE POLICY "Service role search_events" ON search_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_properties_search
  ON properties (is_active, neighborhood, rent_kes, property_type, is_verified)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_properties_owner_active
  ON properties (owner_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_properties_org_active
  ON properties (organization_id, is_active, created_at DESC)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_user_status
  ON payments (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_type_status
  ON payments (payment_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_unlocks_user_listing
  ON contact_unlocks (user_id, listing_id);

CREATE INDEX IF NOT EXISTS idx_search_events_user_date
  ON search_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_search_events_session_date
  ON search_events (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_email_log_user_template
  ON marketing_email_log (user_id, template_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal
  ON subscriptions (status, next_billing_date);

CREATE INDEX IF NOT EXISTS idx_whatsapp_log_phone_date
  ON whatsapp_message_log (wa_phone, created_at DESC);
