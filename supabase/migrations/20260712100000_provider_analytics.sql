-- Provider listing analytics (profile views, contact clicks, quote requests)
CREATE TABLE IF NOT EXISTS provider_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('profile_view', 'directory_view', 'contact_click', 'quote_request')
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_analytics_provider_created
  ON provider_analytics_events (provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_analytics_event_type
  ON provider_analytics_events (provider_id, event_type, created_at DESC);

-- Optional website field for self-serve providers (seed data uses source_url)
ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS source_url TEXT;
