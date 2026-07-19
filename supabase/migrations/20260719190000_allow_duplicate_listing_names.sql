-- Allow multiple active listings that share the same name / fingerprint
-- (e.g. several identical units in one building). Soft duplicate_hash remains
-- for analytics; uniqueness is no longer enforced.

DROP INDEX IF EXISTS idx_properties_duplicate_hash_active_unique;

NOTIFY pgrst, 'reload schema';
