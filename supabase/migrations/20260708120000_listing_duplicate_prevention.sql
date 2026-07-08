-- Listing duplicate prevention: index the identity fingerprint and the
-- structural fields used to look up potential duplicates on create/update.
-- Uniqueness is enforced in the application layer (createProperty/updateProperty)
-- so pre-existing legitimate multi-unit listings are not retroactively broken.

-- Columns exist in generated types but may be missing on older databases.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS duplicate_hash TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS import_batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_duplicate_hash
  ON properties (duplicate_hash)
  WHERE duplicate_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_dedupe_lookup
  ON properties (neighborhood, property_type, bedrooms)
  WHERE is_active;

NOTIFY pgrst, 'reload schema';
