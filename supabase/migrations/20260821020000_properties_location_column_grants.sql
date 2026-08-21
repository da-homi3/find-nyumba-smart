-- Kenya locations added location_* columns after PII lockdown switched
-- properties to column-level SELECT. New columns are invisible to anon /
-- authenticated until explicitly granted — that 42501 tripped the
-- listings-supabase circuit breaker in production.

GRANT SELECT (
  location_id,
  county_location_id,
  constituency_location_id,
  ward_location_id,
  location_match_confidence,
  location_needs_review
) ON public.properties TO anon, authenticated;
