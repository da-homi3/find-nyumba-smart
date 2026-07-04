-- Service provider directory: verification flag + public source URL for seeded listings

ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS verified smallint NOT NULL DEFAULT 0;
ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS source_url text;

-- Directory listings may not map to a NyumbaSearch account; phone optional until verified
ALTER TABLE service_providers ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE service_providers ALTER COLUMN phone DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_providers_verified ON service_providers (verified);
CREATE INDEX IF NOT EXISTS idx_service_providers_status ON service_providers (status);
