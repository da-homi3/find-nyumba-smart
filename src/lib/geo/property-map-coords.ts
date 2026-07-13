import { KENYA_LOCATIONS, matchLocation, neighborhoodStorageValue } from "@/data/kenya-locations";

/** Approximate centroids for Kenya neighbourhoods and towns (WGS84). */
export const NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = (() => {
  const coords: Record<string, { lat: number; lng: number }> = {
    Nairobi: { lat: -1.286389, lng: 36.817223 },
  };

  for (const loc of KENYA_LOCATIONS) {
    const point = { lat: loc.lat, lng: loc.lng };
    const storageKey = neighborhoodStorageValue(loc);
    coords[storageKey] = point;
    if (loc.county === "Nairobi") {
      coords[loc.name] = point;
    }
  }

  return coords;
})();

function isValidCoord(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -5 && lat <= 5 && lng >= 33 && lng <= 42;
}

function stableJitter(id: string): { lat: number; lng: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = Math.trunc(hash * 31 + (id.codePointAt(i) ?? 0));
  }
  const latOff = ((hash & 0xff) / 255 - 0.5) * 0.012;
  const lngOff = (((hash >> 8) & 0xff) / 255 - 0.5) * 0.012;
  return { lat: latOff, lng: lngOff };
}

function resolveNeighborhoodKey(neighborhood: string): string {
  const matched = matchLocation(neighborhood);
  if (matched) {
    const storageKey = neighborhoodStorageValue(matched);
    if (NEIGHBORHOOD_COORDS[storageKey]) return storageKey;
    if (NEIGHBORHOOD_COORDS[matched.name]) return matched.name;
  }

  const norm = neighborhood.trim().toLowerCase();
  if (!norm) return "Nairobi";

  for (const key of Object.keys(NEIGHBORHOOD_COORDS)) {
    const keyNorm = key.toLowerCase();
    if (keyNorm === norm || norm.includes(keyNorm) || keyNorm.includes(norm)) {
      return key;
    }
  }
  return "Nairobi";
}

export function neighborhoodCentroid(neighborhood: string): { lat: number; lng: number } | null {
  const key = resolveNeighborhoodKey(neighborhood);
  return NEIGHBORHOOD_COORDS[key] ?? NEIGHBORHOOD_COORDS.Nairobi ?? null;
}

type MappablePropertyInput = {
  id: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
};

export function resolvePropertyMapCoords(property: MappablePropertyInput): {
  lat: number;
  lng: number;
  approximate: boolean;
} {
  if (
    property.latitude != null &&
    property.longitude != null &&
    isValidCoord(property.latitude, property.longitude)
  ) {
    return { lat: property.latitude, lng: property.longitude, approximate: false };
  }

  const centroid = neighborhoodCentroid(property.neighborhood) ?? NEIGHBORHOOD_COORDS.Nairobi;
  const jitter = stableJitter(property.id);
  return {
    lat: centroid.lat + jitter.lat,
    lng: centroid.lng + jitter.lng,
    approximate: true,
  };
}
