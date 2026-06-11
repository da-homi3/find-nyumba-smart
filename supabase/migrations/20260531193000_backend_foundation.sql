-- Backend foundation: listing analytics and inquiry conversations.

CREATE TABLE IF NOT EXISTS public.property_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_views_property_created
  ON public.property_views(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_views_viewer
  ON public.property_views(viewer_id);

CREATE TABLE IF NOT EXISTS public.inquiry_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry_created
  ON public.inquiry_messages(inquiry_id, created_at ASC);

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_landlord_profile_id_fkey
  FOREIGN KEY (landlord_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_tenant_profile_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inquiries_status_check'
      AND conrelid = 'public.inquiries'::regclass
  ) THEN
    ALTER TABLE public.inquiries
      ADD CONSTRAINT inquiries_status_check
      CHECK (status IN ('new', 'contacted', 'viewing', 'closed', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inquiries_landlord_created
  ON public.inquiries(landlord_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_tenant_created
  ON public.inquiries(tenant_id, created_at DESC);

ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.property_views TO anon, authenticated;
GRANT SELECT ON public.property_views TO authenticated;
GRANT ALL ON public.property_views TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.inquiry_messages TO authenticated;
GRANT ALL ON public.inquiry_messages TO service_role;

CREATE POLICY "Anyone can record property views"
  ON public.property_views
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners view analytics for their properties"
  ON public.property_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_views.property_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Inquiry participants mark messages read"
  ON public.inquiry_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.inquiries i
      WHERE i.id = inquiry_messages.inquiry_id
        AND (i.tenant_id = auth.uid() OR i.landlord_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.record_property_view(
  _property_id UUID,
  _viewer_id UUID DEFAULT auth.uid(),
  _session_id TEXT DEFAULT NULL,
  _source TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.property_views (property_id, viewer_id, session_id, source)
  VALUES (_property_id, _viewer_id, _session_id, _source);

  UPDATE public.properties
  SET views = views + 1
  WHERE id = _property_id;
END;
$$;

CREATE TRIGGER inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

REVOKE EXECUTE ON FUNCTION public.record_property_view(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
