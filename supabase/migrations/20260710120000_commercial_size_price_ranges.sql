-- Commercial listings can advertise a range of unit sizes and prices.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS rent_kes_max integer;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS area_sqm_max integer;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_rent_kes_max_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_rent_kes_max_check
  CHECK (rent_kes_max IS NULL OR rent_kes_max >= rent_kes);

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_area_sqm_max_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_area_sqm_max_check
  CHECK (
    area_sqm_max IS NULL
    OR (area_sqm IS NOT NULL AND area_sqm_max >= area_sqm)
  );

COMMENT ON COLUMN public.properties.rent_kes_max IS
  'Optional upper price for commercial listings (rent_kes is the floor).';

COMMENT ON COLUMN public.properties.area_sqm_max IS
  'Optional upper floor area in m² for commercial listings (area_sqm is the floor).';
