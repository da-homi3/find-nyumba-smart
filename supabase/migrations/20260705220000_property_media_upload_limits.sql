-- Raise property-media bucket limits: images up to 500MB, videos up to 900MB (bucket max = 900MB).

UPDATE storage.buckets
SET
  file_size_limit = 943718400,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/mpeg'
  ]
WHERE id = 'property-media';
