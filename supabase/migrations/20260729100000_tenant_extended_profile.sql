-- Extended tenant profiles: photo + landlord-defined custom fields

ALTER TABLE pm_tenants ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Flexible JSON array for landlord-defined per-tenant fields
-- Shape: [{ "label": "Vehicle plate", "value": "KDA 123X" }]
ALTER TABLE pm_tenants ADD COLUMN IF NOT EXISTS custom_fields TEXT NOT NULL DEFAULT '[]';
