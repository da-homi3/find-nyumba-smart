# Kenya Location Intelligence Layer

Authoritative place hierarchy for NyumbaSearch search, listings filters, landlord pin assist, inventory-gated `/areas` SEO, admin tooling, and demand analytics.

## Design

- **Two parallel trees in one table** (`locations`): electoral hierarchy (`COUNTRY → COUNTY → CONSTITUENCY → WARD`) and informal urban places (`LOCALITY` / `NEIGHBOURHOOD` / `ESTATE`). Estates are **not** electoral children.
- **Preserve free text**: `properties.neighborhood` and `address` stay intact. Reconciliation writes nullable FKs plus confidence / needs-review flags.
- **No invented places**: seed only from named sources + curated catalog. Roads come from OpenStreetMap names only; buildings only from an operator-supplied open GeoJSON.

## Schema

- `20260820140000_kenya_locations.sql` — PostGIS, locations, aliases, sources, property FKs
- `20260820210000_location_phase3.sql` — location audit, location search telemetry, `locations_containing_point` RPC

## Sources & provenance

| Layer | Source | Confidence | Licence |
|-------|--------|------------|---------|
| IEBC hierarchy | stevehoober254/kenya-county-data | 90–95 | See upstream |
| County polygons | geoBoundaries KEN ADM1 | 95 | CC BY 4.0 / ODbL |
| Urban localities | `kenya-locations.json` | 55–70 | First-party catalog |
| Major roads | OpenStreetMap motorway/trunk/primary (named only) | ~70 | ODbL |
| Buildings | Optional file import (Microsoft BF / OSM extracts) | ~55 | Source file |

## Scripts

```bash
npm run seed:locations
npm run reconcile:locations
node scripts/apply-location-phase3.mjs
node scripts/seed-county-polygons.mjs
node scripts/seed-osm-major-roads.mjs
# Optional — real GeoJSON only:
node scripts/seed-building-footprints.mjs path/to/buildings.geojson
```

## Product surfaces

- **APIs**: `/api/locations/*` + Mobile BFF `/api/mobile/v1/locations/*`
- **Ranking tiers**: `inside` → `near` → `marketed_as` when a place filter is active
- **Admin**: Control Center → **Locations** (aliases, activate/deactivate, demand, audit)
- **SEO**: static Nairobi slugs preserved; localities ≥3 listings; **wards ≥1 listing** nationally; empty pages `noindex`
- **Demand**: search + view aggregation in admin Locations tab
- **Flutter**: landlord create-listing neighborhood autocomplete via BFF search; create attaches location FKs

## Inventory refresh

```bash
npm run refresh:location-inventory
```

Updates `locations.inventory_count` from active property FKs (+ neighborhood text fallback). Report: `docs/location-inventory-report.json`.

## KeNHA / KURA note

Official KeNHA/KURA CAD/road networks are not redistributed here. OSM major roads are a temporary open proxy with explicit provenance — replace when licensed official extracts are available.
