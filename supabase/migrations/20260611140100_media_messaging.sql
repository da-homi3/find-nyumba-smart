-- Storage bucket for landlord property media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-media',
  'property-media',
  false,
  104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Landlords manage files under their own uid prefix
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

DROP POLICY IF EXISTS "Users update own property media" ON storage.objects;
CREATE POLICY "Users update own property media"
ON storage.objects FOR UPDATE TO authenticated
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

-- Inquiry thread ordering
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Read receipts for threaded messaging
ALTER TABLE public.inquiry_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_inquiry_messages_thread
  ON public.inquiry_messages (inquiry_id, created_at);

-- Realtime for live chat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'inquiry_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiry_messages;
  END IF;
END $$;
