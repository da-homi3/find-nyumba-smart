-- Email system: logging, marketing dedup, notification preferences

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_marketing_opt_in boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_message_opt_in boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_transactional_opt_in boolean NOT NULL DEFAULT true;

ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;

CREATE TABLE IF NOT EXISTS email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  to_name text,
  template_id text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  provider_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log (status, created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  template_id text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_email_log_user ON marketing_email_log (user_id);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_email_log ENABLE ROW LEVEL SECURITY;

-- Service role only (Worker uses service role)
DROP POLICY IF EXISTS "Service role email_log" ON email_log;
CREATE POLICY "Service role email_log" ON email_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role marketing_email_log" ON marketing_email_log;
CREATE POLICY "Service role marketing_email_log" ON marketing_email_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
