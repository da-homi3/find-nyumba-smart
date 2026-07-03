import { matchNeighborhood } from "@/data/nairobi-neighborhoods";

/** Approximate centroids for Nairobi neighborhoods (WGS84). */
const NAIROBI_CENTER = { lat: -1.286389, lng: 36.817223 };

export const NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {
  Kilimani: { lat: -1.2925, lng: 36.7925 },
  Westlands: { lat: -1.265, lng: 36.8125 },
  Karen: { lat: -1.315, lng: 36.695 },
  Lavington: { lat: -1.29, lng: 36.775 },
  Kileleshwa: { lat: -1.279, lng: 36.79 },
  Kasarani: { lat: -1.21, lng: 36.9 },
  "South B": { lat: -1.31, lng: 36.85 },
  "South C": { lat: -1.3025, lng: 36.834 },
  Roysambu: { lat: -1.2175, lng: 36.88 },
  Embakasi: { lat: -1.305, lng: 36.91 },
  Parklands: { lat: -1.262, lng: 36.825 },
  "Ngong Road": { lat: -1.298, lng: 36.768 },
  Ruaraka: { lat: -1.235, lng: 36.87 },
  Donholm: { lat: -1.295, lng: 36.895 },
  Buruburu: { lat: -1.285, lng: 36.87 },
  Langata: { lat: -1.34, lng: 36.765 },
  Runda: { lat: -1.205, lng: 36.805 },
  Gigiri: { lat: -1.235, lng: 36.785 },
  Hurlingham: { lat: -1.288, lng: 36.765 },
  "Upper Hill": { lat: -1.298, lng: 36.815 },
  CBD: { lat: -1.286, lng: 36.822 },
  Eastleigh: { lat: -1.275, lng: 36.845 },
  Zimmerman: { lat: -1.205, lng: 36.89 },
  "Thika Road": { lat: -1.205, lng: 36.87 },
  Ruaka: { lat: -1.185, lng: 36.775 },
  Ruiru: { lat: -1.15, lng: 36.96 },
  Rongai: { lat: -1.395, lng: 36.73 },
  Tumaini: { lat: -1.3912, lng: 36.7368 },
  Umoja: { lat: -1.285, lng: 36.885 },
  Nairobi: { lat: NAIROBI_CENTER.lat, lng: NAIROBI_CENTER.lng },
};

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
  const matched = matchNeighborhood(neighborhood);
  if (matched && NEIGHBORHOOD_COORDS[matched]) return matched;

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
