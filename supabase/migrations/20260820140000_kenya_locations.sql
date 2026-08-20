-- Kenya Location Intelligence Layer
-- Official admin hierarchy + informal localities; preserves properties.neighborhood text.

CREATE EXTENSION IF NOT EXISTS postgis;

DO $$ BEGIN
  CREATE TYPE public.location_type AS ENUM (
    'COUNTRY',
    'COUNTY',
    'SUB_COUNTY',
    'CONSTITUENCY',
    'WARD',
    'DIVISION',
    'LOCATION',
    'SUB_LOCATION',
    'TOWN',
    'CITY',
    'MUNICIPALITY',
    'LOCALITY',
    'VILLAGE',
    'ESTATE',
    'NEIGHBOURHOOD',
    'MARKET',
    'TRADING_CENTRE',
    'ROAD',
    'STREET',
    'LANDMARK',
    'POSTAL_AREA',
    'BUILDING',
    'PROPERTY',
    'UNVERIFIED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.location_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  dataset_name TEXT,
  source_url TEXT,
  accessed_at TIMESTAMPTZ,
  dataset_version TEXT,
  geographic_coverage TEXT,
  identifier_system TEXT,
  licence TEXT,
  confidence_default SMALLINT NOT NULL DEFAULT 80 CHECK (confidence_default BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.locations (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  slug TEXT NOT NULL,
  location_type public.location_type NOT NULL,
  official_code TEXT,
  country_code TEXT NOT NULL DEFAULT 'KE',
  county_code TEXT,
  constituency_code TEXT,
  ward_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geom geometry(Geometry, 4326),
  bbox DOUBLE PRECISION[4],
  source TEXT NOT NULL,
  source_id TEXT,
  source_url TEXT,
  confidence_score SMALLINT NOT NULL DEFAULT 80 CHECK (confidence_score BETWEEN 0 AND 100),
  is_official BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  inventory_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT locations_lat_lng_valid CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (
      latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND latitude BETWEEN -5 AND 6
      AND longitude BETWEEN 33 AND 43
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS locations_source_source_id_uidx
  ON public.locations (source, source_id)
  WHERE source_id IS NOT NULL;

-- PostgREST upsert requires a table UNIQUE constraint (not only a partial index).
ALTER TABLE public.locations DROP CONSTRAINT IF EXISTS locations_source_source_id_key;
ALTER TABLE public.locations ADD CONSTRAINT locations_source_source_id_key UNIQUE (source, source_id);

CREATE UNIQUE INDEX IF NOT EXISTS locations_type_official_code_uidx
  ON public.locations (location_type, official_code)
  WHERE official_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS locations_parent_type_slug_uidx
  ON public.locations (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), location_type, slug);

CREATE INDEX IF NOT EXISTS locations_parent_id_idx ON public.locations (parent_id);
CREATE INDEX IF NOT EXISTS locations_location_type_idx ON public.locations (location_type);
CREATE INDEX IF NOT EXISTS locations_normalized_name_idx ON public.locations (normalized_name);
CREATE INDEX IF NOT EXISTS locations_slug_idx ON public.locations (slug);
CREATE INDEX IF NOT EXISTS locations_county_code_idx ON public.locations (county_code);
CREATE INDEX IF NOT EXISTS locations_active_type_idx ON public.locations (is_active, location_type);
CREATE INDEX IF NOT EXISTS locations_lat_lng_idx
  ON public.locations (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS locations_geom_gix ON public.locations USING GIST (geom)
  WHERE geom IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.location_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations (id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  alias_kind TEXT NOT NULL DEFAULT 'common'
    CHECK (alias_kind IN (
      'official',
      'common',
      'spelling',
      'abbreviation',
      'former',
      'colloquial',
      'swahili',
      'search',
      'typo'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS location_aliases_normalized_idx ON public.location_aliases (normalized_alias);
CREATE INDEX IF NOT EXISTS location_aliases_location_id_idx ON public.location_aliases (location_id);

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS county_location_id UUID REFERENCES public.locations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS constituency_location_id UUID REFERENCES public.locations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ward_location_id UUID REFERENCES public.locations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_match_confidence SMALLINT
    CHECK (location_match_confidence IS NULL OR location_match_confidence BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS location_needs_review BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS properties_location_id_idx ON public.properties (location_id)
  WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS properties_county_location_id_idx ON public.properties (county_location_id)
  WHERE county_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS properties_ward_location_id_idx ON public.properties (ward_location_id)
  WHERE ward_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS properties_location_needs_review_idx ON public.properties (location_needs_review)
  WHERE location_needs_review = true;

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS locations_public_read ON public.locations;
CREATE POLICY locations_public_read ON public.locations
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS location_aliases_public_read ON public.location_aliases;
CREATE POLICY location_aliases_public_read ON public.location_aliases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.locations l
      WHERE l.id = location_id AND l.is_active = true
    )
  );

DROP POLICY IF EXISTS location_sources_public_read ON public.location_sources;
CREATE POLICY location_sources_public_read ON public.location_sources
  FOR SELECT USING (true);

GRANT SELECT ON public.locations TO anon, authenticated;
GRANT SELECT ON public.location_aliases TO anon, authenticated;
GRANT SELECT ON public.location_sources TO anon, authenticated;
