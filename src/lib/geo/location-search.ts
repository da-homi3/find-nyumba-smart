import {
  KENYA_LOCATIONS,
  neighborhoodStorageValue,
  type KenyaLocation,
} from "@/data/kenya-locations";

export type LocationSearchResult = {
  id: string;
  label: string;
  subtitle?: string;
  lat: number;
  lng: number;
  /** Kenya catalog storage value when applicable. */
  neighborhood?: string;
  source: "kenya" | "mapbox";
};

function scoreKenyaLocation(location: KenyaLocation, norm: string): number {
  const name = location.name.toLowerCase();
  const county = location.county.toLowerCase();
  const label = neighborhoodStorageValue(location).toLowerCase();

  if (name === norm || label === norm) return 100;
  if (name.startsWith(norm)) return 90;
  if (label.startsWith(norm)) return 85;
  if (name.includes(norm)) return 70;
  if (label.includes(norm)) return 65;
  if (county.startsWith(norm)) return 40;
  if (county.includes(norm) && name.includes(norm.split(/\s+/)[0] ?? norm)) return 50;
  return 0;
}

export function searchKenyaLocations(query: string, limit = 8): LocationSearchResult[] {
  const norm = query.trim().toLowerCase();
  if (norm.length < 2) return [];

  return KENYA_LOCATIONS.map((location) => ({
    location,
    score: scoreKenyaLocation(location, norm),
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.location.name.localeCompare(b.location.name))
    .slice(0, limit)
    .map(({ location }) => ({
      id: `kenya:${location.county}:${location.name}`,
      label: location.name,
      subtitle: location.county,
      lat: location.lat,
      lng: location.lng,
      neighborhood: neighborhoodStorageValue(location),
      source: "kenya" as const,
    }));
}

type MapboxFeature = {
  id: string;
  place_name: string;
  center: [number, number];
};

export async function searchMapboxPlaces(
  query: string,
  token: string,
  limit = 5,
): Promise<LocationSearchResult[]> {
  const norm = query.trim();
  if (norm.length < 3) return [];

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(norm)}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "KE");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("types", "address,poi,neighborhood,locality,place");

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as { features?: MapboxFeature[] };
  return (data.features ?? []).map((feature) => ({
    id: `mapbox:${feature.id}`,
    label: feature.place_name.split(",")[0]?.trim() || feature.place_name,
    subtitle: feature.place_name,
    lat: feature.center[1],
    lng: feature.center[0],
    source: "mapbox" as const,
  }));
}

function isNear(a: LocationSearchResult, b: LocationSearchResult, epsilon = 0.002): boolean {
  return Math.abs(a.lat - b.lat) < epsilon && Math.abs(a.lng - b.lng) < epsilon;
}

export async function searchLocations(
  query: string,
  options?: { mapboxToken?: string | null; limit?: number },
): Promise<LocationSearchResult[]> {
  const limit = options?.limit ?? 8;
  const local = searchKenyaLocations(query, limit);

  const token = options?.mapboxToken?.trim();
  if (!token?.startsWith("pk.") || query.trim().length < 3) {
    return local;
  }

  try {
    const remote = await searchMapboxPlaces(query, token, Math.max(3, limit - local.length));
    const merged = [...local];
    for (const place of remote) {
      if (!merged.some((existing) => isNear(existing, place))) {
        merged.push(place);
      }
    }
    return merged.slice(0, limit);
  } catch {
    return local;
  }
}
