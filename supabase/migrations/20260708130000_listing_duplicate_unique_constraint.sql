-- Hard uniqueness for active listings: one live listing per property fingerprint.
-- Deactivate newer duplicates first so the partial unique index can be created safely.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY duplicate_hash
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM properties
  WHERE is_active = true
    AND duplicate_hash IS NOT NULL
)
UPDATE properties AS p
SET
  is_active = false,
  updated_at = NOW()
FROM ranked AS r
WHERE p.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_duplicate_hash_active_unique
  ON properties (duplicate_hash)
  WHERE is_active = true AND duplicate_hash IS NOT NULL;

NOTIFY pgrst, 'reload schema';
