-- Private bucket for user identity / business / ownership verification uploads

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  false,
  26214400,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users upload own verification docs" ON storage.objects;
CREATE POLICY "Users upload own verification docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'verification-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users read own verification docs" ON storage.objects;
CREATE POLICY "Users read own verification docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'verification-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users delete own verification docs" ON storage.objects;
CREATE POLICY "Users delete own verification docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'verification-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins review via service role (bypasses RLS)
