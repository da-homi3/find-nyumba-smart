-- Health/security hardening: moderate anonymous reviews and persist cron outcomes.

ALTER TABLE public.platform_reviews
  ALTER COLUMN is_published SET DEFAULT false;

CREATE TABLE IF NOT EXISTS public.cron_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('succeeded', 'failed', 'partial')),
  http_status integer,
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cron_run_log_job_finished_idx
  ON public.cron_run_log (job_name, finished_at DESC);

ALTER TABLE public.cron_run_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cron_run_log FROM anon, authenticated;
GRANT ALL ON public.cron_run_log TO service_role;

-- Legacy score triggers were created as SECURITY DEFINER without a pinned path.
DO $$
DECLARE
  signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.sync_profile_verifications()',
    'public.recalculate_landlord_property_scores(uuid)',
    'public.calculate_authenticity_score(uuid)',
    'public.calculate_health_score(uuid)',
    'public.sync_property_scores()'
  ]
  LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', signature);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', signature);
    END IF;
  END LOOP;
END;
$$;

-- Retention is executed by the daily cron route.
