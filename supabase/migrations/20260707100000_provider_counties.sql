-- County-level filtering for service provider directory
ALTER TABLE service_providers
  ADD COLUMN IF NOT EXISTS counties JSONB NOT NULL DEFAULT '["Nairobi"]'::jsonb;

CREATE TABLE IF NOT EXISTS provider_counties (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO provider_counties (code, name) VALUES
  ('nairobi', 'Nairobi'),
  ('mombasa', 'Mombasa'),
  ('kisumu', 'Kisumu'),
  ('nakuru', 'Nakuru'),
  ('kiambu', 'Kiambu'),
  ('machakos', 'Machakos'),
  ('uasin_gishu', 'Uasin Gishu (Eldoret)'),
  ('kajiado', 'Kajiado'),
  ('kericho', 'Kericho'),
  ('kisii', 'Kisii'),
  ('kakamega', 'Kakamega'),
  ('nyeri', 'Nyeri'),
  ('meru', 'Meru'),
  ('narok', 'Narok')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_service_providers_counties
  ON service_providers USING GIN (counties);

UPDATE service_providers
SET counties = '["Nairobi"]'::jsonb
WHERE counties IS NULL;

UPDATE service_providers
SET counties = '["Nairobi","Mombasa","Nakuru","Kiambu","Machakos","Uasin Gishu (Eldoret)","Kericho","Kisii","Kakamega","Nyeri","Meru","Narok"]'::jsonb
WHERE business_name LIKE 'Bestcare%';
