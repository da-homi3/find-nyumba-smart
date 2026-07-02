-- Platform extensions: import batches, WhatsApp sessions, API keys, marketing email log

CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_type text NOT NULL DEFAULT 'csv',
  total_rows int NOT NULL DEFAULT 0,
  imported_rows int NOT NULL DEFAULT 0,
  failed_rows int NOT NULL DEFAULT 0,
  duplicate_rows int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing',
  error_report jsonb,
  property_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_user ON import_batches(user_id);

ALTER TABLE properties ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES import_batches(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS duplicate_hash text;
CREATE INDEX IF NOT EXISTS idx_properties_duplicate_hash ON properties(duplicate_hash);

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id),
  state text NOT NULL DEFAULT 'start',
  draft_listing jsonb,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scope text NOT NULL DEFAULT 'listings',
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON integration_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON integration_api_keys(key_hash);

CREATE TABLE IF NOT EXISTS integration_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{listing.created,listing.updated}',
  secret text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_id text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, template_id)
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_marketing_opt_in boolean NOT NULL DEFAULT true;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;
