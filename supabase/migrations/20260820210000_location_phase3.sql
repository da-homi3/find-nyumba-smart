-- Phase 3: location audit, search telemetry, reverse-geocode RPC, demand helpers.

CREATE TABLE IF NOT EXISTS public.location_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES public.locations (id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'alias_add',
    'alias_remove',
    'alias_merge',
    'activate',
    'deactivate',
    'parent_reassign',
    'review_flag',
    'review_clear',
    'geom_update',
    'note'
  )),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_audit_events_location_id_idx
  ON public.location_audit_events (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS location_audit_events_created_at_idx
  ON public.location_audit_events (created_at DESC);

CREATE TABLE IF NOT EXISTS public.location_search_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT,
  normalized_query TEXT,
  selected_location_id UUID REFERENCES public.locations (id) ON DELETE SET NULL,
  result_count INTEGER,
  session_id TEXT,
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'mobile', 'admin', 'api')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_search_events_norm_idx
  ON public.location_search_events (normalized_query, created_at DESC);
CREATE INDEX IF NOT EXISTS location_search_events_selected_idx
  ON public.location_search_events (selected_location_id, created_at DESC)
  WHERE selected_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS location_search_events_created_at_idx
  ON public.location_search_events (created_at DESC);

ALTER TABLE public.search_events
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS search_events_location_id_idx
  ON public.search_events (location_id)
  WHERE location_id IS NOT NULL;

-- Point-in-polygon reverse geocode when geom is present.
CREATE OR REPLACE FUNCTION public.locations_containing_point(lat double precision, lng double precision)
RETURNS SETOF public.locations
LANGUAGE sql
STABLE
AS $$
  SELECT l.*
  FROM public.locations l
  WHERE l.is_active = true
    AND l.geom IS NOT NULL
    AND ST_Contains(
      l.geom,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    )
  ORDER BY
    CASE l.location_type
      WHEN 'WARD' THEN 1
      WHEN 'CONSTITUENCY' THEN 2
      WHEN 'COUNTY' THEN 3
      WHEN 'NEIGHBOURHOOD' THEN 0
      WHEN 'LOCALITY' THEN 0
      ELSE 9
    END,
    l.confidence_score DESC
  LIMIT 20;
$$;

ALTER TABLE public.location_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_search_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS location_audit_events_admin_all ON public.location_audit_events;
CREATE POLICY location_audit_events_admin_all ON public.location_audit_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS location_search_events_insert_public ON public.location_search_events;
CREATE POLICY location_search_events_insert_public ON public.location_search_events
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS location_search_events_admin_select ON public.location_search_events;
CREATE POLICY location_search_events_admin_select ON public.location_search_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

GRANT SELECT, INSERT ON public.location_search_events TO anon, authenticated;
GRANT ALL ON public.location_audit_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.locations_containing_point(double precision, double precision)
  TO anon, authenticated, service_role;
