import {
  KENYA_LOCATIONS,
  neighborhoodStorageValue,
  type KenyaLocation,
} from "@/data/kenya-locations";
import { haversineKm } from "@/lib/locations/normalize";

/** Max distance (km) for centroid adjacency used by recommendation nearby scoring. */
const ADJACENCY_KM = 7;
const ADJACENCY_LIMIT = 6;

function locationKey(loc: KenyaLocation): string {
  return neighborhoodStorageValue(loc).trim().toLowerCase().replace(/\s+/g, " ");
}

function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Build nearby clusters from curated catalog centroids (no invented places).
 * Keys use both bare neighbourhood name and "name, county" storage forms.
 */
function buildCentroidAdjacency(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const origin of KENYA_LOCATIONS) {
    const ranked = KENYA_LOCATIONS.map((candidate) => ({
      candidate,
      km: haversineKm(origin.lat, origin.lng, candidate.lat, candidate.lng),
    }))
      .filter(
        (row) =>
          row.km > 0.05 &&
          row.km <= ADJACENCY_KM &&
          nameKey(row.candidate.name) !== nameKey(origin.name),
      )
      .sort((a, b) => a.km - b.km)
      .slice(0, ADJACENCY_LIMIT)
      .map((row) => nameKey(row.candidate.name));

    if (ranked.length === 0) continue;
    const keys = new Set([nameKey(origin.name), locationKey(origin)]);
    for (const key of keys) {
      const existing = out[key] ?? [];
      out[key] = [...new Set([...existing, ...ranked])].slice(0, ADJACENCY_LIMIT);
    }
  }
  return out;
}

const CENTROID_NEARBY = buildCentroidAdjacency();

/**
 * Explicit hand-tuned clusters kept as soft supplements for dense Nairobi pockets
 * where catalog spacing alone under-connects marketed neighbourhood names.
 */
const HAND_TUNED: Record<string, string[]> = {
  kilimani: ["hurlingham", "lavington", "kileleshwa", "ngong road", "yaya"],
  hurlingham: ["kilimani", "kileleshwa", "lavington"],
  "south b": ["south c", "nairobi west"],
  "south c": ["south b", "langata"],
};

function mergeNearby(base: string[], extra: string[] | undefined): string[] {
  if (!extra?.length) return base;
  return [...new Set([...base, ...extra.map(nameKey)])].slice(0, ADJACENCY_LIMIT + 2);
}

export function normalizeLocation(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseLocations(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;/|]+/)
    .map(normalizeLocation)
    .filter((s) => s.length >= 2);
}

/** Nearby neighbourhood names from centroid adjacency (+ light hand-tuned fill). */
export function nearbyLocations(location: string): string[] {
  const key = normalizeLocation(location);
  const fromCentroids = CENTROID_NEARBY[key] ?? [];
  const bare = key.includes(",") ? normalizeLocation(key.split(",")[0] ?? key) : key;
  const fromBare = bare !== key ? (CENTROID_NEARBY[bare] ?? []) : [];
  const tuned = HAND_TUNED[bare] ?? HAND_TUNED[key];
  return mergeNearby([...fromCentroids, ...fromBare], tuned);
}

export function locationRelation(
  propertyNeighborhood: string,
  preferred: string[],
): "exact" | "nearby" | "none" {
  const hood = normalizeLocation(propertyNeighborhood);
  if (!hood || preferred.length === 0) return "none";
  if (preferred.some((p) => hood.includes(p) || p.includes(hood))) return "exact";
  for (const pref of preferred) {
    const near = nearbyLocations(pref);
    if (near.some((n) => hood.includes(n) || n.includes(hood))) return "nearby";
  }
  return "none";
}
