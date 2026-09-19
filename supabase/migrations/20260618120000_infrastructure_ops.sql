-- Infrastructure ops tables: alerts, rate limits, cookie consent

CREATE TABLE IF NOT EXISTS public.alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_log_severity_date
  ON public.alert_log (severity, resolved, created_at DESC);

ALTER TABLE public.alert_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  endpoint text NOT NULL,
  request_count integer NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier
  ON public.rate_limit_log (identifier, endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_blocked
  ON public.rate_limit_log (blocked, created_at DESC)
  WHERE blocked = true;

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.cookie_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  ip_hash text NOT NULL,
  necessary boolean NOT NULL DEFAULT true,
  analytics boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  preferences boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT '1.0',
  given_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cookie_consent_given
  ON public.cookie_consent (given_at DESC);

ALTER TABLE public.cookie_consent ENABLE ROW LEVEL SECURITY;

-- Service role only (no public policies)
COMMENT ON TABLE public.alert_log IS 'Ops alerts — service role writes only';
COMMENT ON TABLE public.rate_limit_log IS 'Rate limit audit — service role writes only';
COMMENT ON TABLE public.cookie_consent IS 'GDPR/DPA cookie consent records';
