-- Multiple listing contact numbers (primary stays in contact_phone for back-compat)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS contact_phones text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.properties.contact_phones IS
  'All unlockable listing contact numbers; contact_phone is the primary (first)';

-- Backfill from existing single contact_phone
UPDATE public.properties
SET contact_phones = ARRAY[trim(contact_phone)]
WHERE contact_phone IS NOT NULL
  AND trim(contact_phone) <> ''
  AND (
    contact_phones IS NULL
    OR cardinality(contact_phones) = 0
  );
