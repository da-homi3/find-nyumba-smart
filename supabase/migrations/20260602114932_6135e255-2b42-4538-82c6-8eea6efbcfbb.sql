
CREATE TABLE IF NOT EXISTS public.inquiry_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiry_messages TO authenticated;
GRANT ALL ON public.inquiry_messages TO service_role;

ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inquiry participants view messages"
ON public.inquiry_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.inquiries i
    WHERE i.id = inquiry_id
      AND (auth.uid() = i.tenant_id OR auth.uid() = i.landlord_id)
  )
);

CREATE POLICY "Inquiry participants send messages"
ON public.inquiry_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.inquiries i
    WHERE i.id = inquiry_id
      AND (auth.uid() = i.tenant_id OR auth.uid() = i.landlord_id)
  )
);

CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry ON public.inquiry_messages(inquiry_id, created_at);

-- Property views tracking
CREATE TABLE IF NOT EXISTS public.property_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  viewer_id uuid,
  session_id text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.property_views TO anon, authenticated;
GRANT ALL ON public.property_views TO service_role;

ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their property analytics"
ON public.property_views FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.record_property_view(
  _property_id uuid,
  _viewer_id uuid,
  _session_id text,
  _source text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.property_views (property_id, viewer_id, session_id, source)
  VALUES (_property_id, _viewer_id, _session_id, _source);
  UPDATE public.properties SET views = views + 1 WHERE id = _property_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_property_view(uuid, uuid, text, text) TO anon, authenticated, service_role;
