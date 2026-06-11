-- Additional seed listings for Rongai, Ruaka, and Kilimani coverage

INSERT INTO public.properties (id, owner_id, title, property_type, neighborhood, address, latitude, longitude, rent_kes, deposit_kes, bedrooms, bathrooms, area_sqm, description, amenities, images, is_verified, is_active, authenticity_score, available_from, views, created_at, updated_at)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567891', NULL, 'Affordable 2BR — Rongai', 'two_bedroom'::public.property_type, 'Rongai', 'Tuskys Stage Rd', -1.3938, 36.7378, 18000, 18000, 2, 1, 65, 'Quiet 2BR near matatu stage. Ideal for commuters on a budget — no agent fees.', ARRAY['Water','Security','Parking']::text[], ARRAY['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200']::text[], TRUE, TRUE, 72, '2026-06-01', 0, NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567892', NULL, 'Bedsitter — Ruaka Town', 'bedsitter'::public.property_type, 'Ruaka', 'Ruaka Town Centre', -1.2012, 36.8265, 15000, 15000, 0, 1, 25, 'New building near Two Rivers. Fibre-ready, gated compound.', ARRAY['WiFi','Security','Parking','Borehole']::text[], ARRAY['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200']::text[], TRUE, TRUE, 78, '2026-06-01', 0, NOW(), NOW()),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567893', NULL, '3BR Family Flat — South B', 'three_bedroom'::public.property_type, 'South B', 'Ole Sereni Dr', -1.3122, 36.8412, 42000, 84000, 3, 2, 110, 'Spacious family unit with borehole water and 24hr security.', ARRAY['Borehole','Security','Parking','WiFi']::text[], ARRAY['https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200','https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200']::text[], TRUE, TRUE, 85, '2026-06-01', 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.property_attributes (property_id, water_reliability, security_rating, parking, internet_providers, has_borehole)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567891', 2, 3, TRUE, ARRAY['Safaricom']::text[], FALSE),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567892', 3, 4, TRUE, ARRAY['Safaricom','Faiba']::text[], TRUE),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567893', 4, 4, TRUE, ARRAY['Safaricom','Zuku']::text[], TRUE)
ON CONFLICT (property_id) DO NOTHING;
