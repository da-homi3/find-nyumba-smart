# Kenya Location Intelligence Layer

Authoritative place hierarchy for NyumbaSearch search, listings filters, landlord pin assist, and inventory-gated `/areas` SEO.

## Design

- **Two parallel trees in one table** (`locations`): electoral hierarchy (`COUNTRY → COUNTY → CONSTITUENCY → WARD`) and informal urban places (`LOCALITY` / `NEIGHBOURHOOD` / `ESTATE`). Estates are **not** electoral children.
- **Preserve free text**: `properties.neighborhood` and `address` stay intact. Reconciliation writes nullable FKs (`location_id`, `county_location_id`, `constituency_location_id`, `ward_location_id`) plus `location_match_confidence` / `location_needs_review`.
- **No invented places**: seed only from named sources + the existing curated `kenya-locations.json` catalog.

## Schema

Migration: `find-nyumba-smart/supabase/migrations/20260820140000_kenya_locations.sql`

- Enables PostGIS (`CREATE EXTENSION postgis`)
- Tables: `location_sources`, `locations`, `location_aliases`
- Property FK columns (nullable)
- RLS: public `SELECT` on active locations; writes via service role

## Sources & provenance

| Layer | Source | Confidence | Notes |
|-------|--------|------------|-------|
| Country | Fixed `KE` | 100 | |
| 47 Counties + ~290 Constituencies + ~1450 Wards | [stevehoober254/kenya-county-data](https://github.com/stevehoober254/kenya-county-data) (IEBC-derived hierarchy JSON) | 90–95 | Stored under `source = iebc-hierarchy-stevehoober254`. IEBC “constituency” naming may differ from KNBS sub-county labels — type is explicit. |
| Urban localities | `find-nyumba-smart/src/data/kenya-locations.json` | 55–70 | `is_official = false`; parented to county by name (with Nairobi City / Murang’a aliases) |

Cached hierarchy file: `find-nyumba-smart/data/kenya-admin/county_data.json`  
Seed report: `find-nyumba-smart/docs/location-seed-report.json`  
Reconcile report: `find-nyumba-smart/docs/location-reconcile-report.json`

Licence / refresh: re-download the IEBC-derived JSON when IEBC updates boundaries; re-run seed (idempotent upsert on `(source, source_id)`). Do not invent wards or roads.

## Scripts

```bash
# From find-nyumba-smart/
node scripts/seed-kenya-locations.mjs
node scripts/reconcile-property-locations.mjs
```

Seed is idempotent. Reconcile never deletes `neighborhood` text.

## HTTP APIs (rate-limited)

All under `/api/locations/*`:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/locations/search?q=` | Autocomplete (name + alias + type boost + optional lat/lng) |
| `GET /api/locations/resolve?q=` | Best structured entity |
| `GET /api/locations/nearby?lat=&lng=&radius_km=` | Nearby urban places |
| `GET /api/locations/reverse?lat=&lng=` | County/constituency/ward/locality (polygon RPC if present, else nearest centroid) |
| `GET /api/locations/:id` | Detail |
| `GET /api/locations/:id/children` | Children |
| `GET /api/locations/:id/ancestors` | Ancestor chain |

Library: `find-nyumba-smart/src/lib/locations/`

## Product wiring

- **Listings**: `locationId` / county / constituency / ward filters preferred; neighborhood string fallback (`listings-core.ts`).
- **Place search UI**: `/api/locations/search` first, Mapbox for roads/POIs (`location-search.ts` + `PlaceSearchField`).
- **Landlord picker**: reverse geocode warns when pin disagrees with selected neighborhood; does not auto-overwrite.
- **SEO**: `/areas` merges stable Nairobi static slugs with DB rows where `inventory_count >= 3`; thin pages are `noindex`.

## Acceptance checks

- Seed counts: 47 counties, ≈290 constituencies, ≈1450 wards, zero orphan wards in hierarchy seed.
- Resolve: Westlands / westland / Kilimani Nairobi / Ruaka / CBD → structured entities; Kangemi disambiguated by parent when county hint present.
- Original `properties.neighborhood` text unchanged after reconcile.

## Deferred (Phase 3+)

Admin merge UI, KeNHA/KURA roads, building footprints, national SEO for every ward, Flutter deep UI wiring beyond BFF search/resolve.

### Mobile BFF (Phase 2)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/mobile/v1/locations/search` | Autocomplete |
| `GET /api/mobile/v1/locations/resolve` | Best match |
| `GET /api/mobile/v1/locations/reverse` | Pin → admin/locality |
| `GET /api/mobile/v1/locations/nearby` | Nearby places |
| `GET /api/mobile/v1/locations/suggest-neighborhood` | Landlord pin/text suggest (auth) |

Listings accept `locationId` / county / constituency / ward query params.
