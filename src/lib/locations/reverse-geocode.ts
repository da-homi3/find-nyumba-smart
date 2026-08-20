import type { LocationsDb } from "./db";
import { haversineKm } from "./normalize";
import { toPublicLocation } from "./format";
import type { LocationRow, LocationPublic, ReverseGeocodeResult } from "./types";

const SELECT_COLS =
  "id,parent_id,name,normalized_name,slug,location_type,latitude,longitude,is_official,confidence_score,inventory_count";

async function nearestOfType(
  supabase: LocationsDb,
  type: string,
  lat: number,
  lng: number,
  maxKm: number,
): Promise<{ loc: LocationPublic; distanceKm: number } | null> {
  const d = maxKm / 111;
  const { data } = await supabase
    .from("locations")
    .select(SELECT_COLS)
    .eq("is_active", true)
    .eq("location_type", type)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", lat - d)
    .lte("latitude", lat + d)
    .gte("longitude", lng - d)
    .lte("longitude", lng + d)
    .limit(80);

  let best: { loc: LocationPublic; distanceKm: number } | null = null;
  for (const raw of data ?? []) {
    const row = raw as unknown as LocationRow;
    if (row.latitude == null || row.longitude == null) continue;
    const distanceKm = haversineKm(lat, lng, row.latitude, row.longitude);
    if (distanceKm > maxKm) continue;
    if (!best || distanceKm < best.distanceKm) {
      best = { loc: toPublicLocation(row), distanceKm };
    }
  }
  return best;
}

/**
 * Reverse geocode a point. Prefers PostGIS point-in-polygon when geom exists;
 * falls back to nearest centroids (lower confidence).
 */
export async function reverseGeocode(
  supabase: LocationsDb,
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      county: null,
      constituency: null,
      ward: null,
      locality: null,
      confidence: 0,
      method: "none",
    };
  }

  try {
    const { data: pip, error } = await supabase.rpc("locations_containing_point" as never, {
      lat,
      lng,
    } as never);
    if (!error && Array.isArray(pip) && pip.length > 0) {
      const rows = pip as LocationRow[];
      const pick = (t: string) => {
        const row = rows.find((r) => r.location_type === t);
        return row ? toPublicLocation(row) : null;
      };
      return {
        county: pick("COUNTY"),
        constituency: pick("CONSTITUENCY"),
        ward: pick("WARD"),
        locality: pick("NEIGHBOURHOOD") ?? pick("LOCALITY") ?? pick("ESTATE"),
        confidence: 92,
        method: "polygon",
      };
    }
  } catch {
    // RPC not deployed — centroid fallback
  }

  const [county, constituency, ward, locality, neighbourhood] = await Promise.all([
    nearestOfType(supabase, "COUNTY", lat, lng, 80),
    nearestOfType(supabase, "CONSTITUENCY", lat, lng, 40),
    nearestOfType(supabase, "WARD", lat, lng, 15),
    nearestOfType(supabase, "LOCALITY", lat, lng, 12),
    nearestOfType(supabase, "NEIGHBOURHOOD", lat, lng, 8),
  ]);

  const bestLocal =
    neighbourhood && locality
      ? neighbourhood.distanceKm <= locality.distanceKm
        ? neighbourhood
        : locality
      : (neighbourhood ?? locality);

  const confidence = county
    ? Math.max(35, Math.round(75 - (county.distanceKm ?? 0) * 1.5))
    : 0;

  return {
    county: county?.loc ?? null,
    constituency: constituency?.loc ?? null,
    ward: ward?.loc ?? null,
    locality: bestLocal?.loc ?? null,
    confidence,
    method: county ? "nearest_centroid" : "none",
  };
}

export async function nearbyLocations(
  supabase: LocationsDb,
  lat: number,
  lng: number,
  radiusKm = 15,
  limit = 20,
): Promise<Array<LocationPublic & { distanceKm: number }>> {
  const d = Math.min(Math.max(radiusKm, 1), 80) / 111;
  const { data } = await supabase
    .from("locations")
    .select(SELECT_COLS)
    .eq("is_active", true)
    .in("location_type", ["NEIGHBOURHOOD", "LOCALITY", "ESTATE", "WARD", "TOWN"])
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", lat - d)
    .lte("latitude", lat + d)
    .gte("longitude", lng - d)
    .lte("longitude", lng + d)
    .limit(120);

  const hits: Array<LocationPublic & { distanceKm: number }> = [];
  for (const raw of data ?? []) {
    const row = raw as unknown as LocationRow;
    if (row.latitude == null || row.longitude == null) continue;
    const distanceKm = haversineKm(lat, lng, row.latitude, row.longitude);
    if (distanceKm > radiusKm) continue;
    hits.push({ ...toPublicLocation(row), distanceKm });
  }
  hits.sort((a, b) => a.distanceKm - b.distanceKm);
  return hits.slice(0, Math.min(Math.max(limit, 1), 50));
}
