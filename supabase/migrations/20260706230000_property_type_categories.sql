-- Expand property_type enum for additional rental categories.
ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'four_bedroom';
ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'penthouse';
ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'guest_house';
ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'commercial';
