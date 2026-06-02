
-- Storage RLS for property-media bucket
CREATE POLICY "Landlords upload to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'property-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND public.has_role(auth.uid(), 'landlord'::app_role)
);

CREATE POLICY "Landlords update own files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'property-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Landlords delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'property-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated read property-media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'property-media');

-- Property quality reports
CREATE TABLE public.property_quality_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  grade text NOT NULL,
  summary text NOT NULL,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvements jsonb NOT NULL DEFAULT '[]'::jsonb,
  media_count integer NOT NULL DEFAULT 0,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_quality_reports TO authenticated;
GRANT ALL ON public.property_quality_reports TO service_role;

ALTER TABLE public.property_quality_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own reports"
ON public.property_quality_reports FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Owners insert own reports"
ON public.property_quality_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_pqr_property ON public.property_quality_reports(property_id, created_at DESC);

-- Add tour url column to properties for 360 tours
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tour_url text;
