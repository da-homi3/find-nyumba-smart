-- RLS for messaging, payments, admin; storage bucket for property media

-- inquiry_messages: participants can read/write
DROP POLICY IF EXISTS "Inquiry participants read messages" ON public.inquiry_messages;
CREATE POLICY "Inquiry participants read messages" ON public.inquiry_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
        AND (i.tenant_id = auth.uid() OR i.landlord_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Inquiry participants send messages" ON public.inquiry_messages;
CREATE POLICY "Inquiry participants send messages" ON public.inquiry_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
        AND (i.tenant_id = auth.uid() OR i.landlord_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Recipients mark messages read" ON public.inquiry_messages;
CREATE POLICY "Recipients mark messages read" ON public.inquiry_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
        AND (i.tenant_id = auth.uid() OR i.landlord_id = auth.uid())
    )
  );

-- payments: users can create own payment rows
DROP POLICY IF EXISTS "Users insert own payments" ON public.payments;
CREATE POLICY "Users insert own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- scam reports: admin can update status
DROP POLICY IF EXISTS "Admin update scam reports" ON public.scam_reports;
CREATE POLICY "Admin update scam reports" ON public.scam_reports
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- inquiries: org managers can update status on portfolio properties
DROP POLICY IF EXISTS "Org staff update inquiry status" ON public.inquiries;
CREATE POLICY "Org staff update inquiry status" ON public.inquiries
  FOR UPDATE USING (
    auth.uid() = landlord_id
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = property_id
        AND om.user_id = auth.uid()
    )
  );

-- user_roles read (idempotent if portal migration already applied)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- property_quality_reports table (if missing)
CREATE TABLE IF NOT EXISTS public.property_quality_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL DEFAULT 0,
  image_quality INTEGER,
  description_quality INTEGER,
  pricing_fairness INTEGER,
  completeness INTEGER,
  suggestions JSONB DEFAULT '[]'::jsonb,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id)
);

ALTER TABLE public.property_quality_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read quality reports" ON public.property_quality_reports;
CREATE POLICY "Owners read quality reports" ON public.property_quality_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

-- property-media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-media',
  'property-media',
  false,
  104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload own property media" ON storage.objects;
CREATE POLICY "Users upload own property media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'property-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users read own property media" ON storage.objects;
CREATE POLICY "Users read own property media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'property-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users delete own property media" ON storage.objects;
CREATE POLICY "Users delete own property media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'property-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Enable realtime for inquiry_messages (idempotent)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiry_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
