import {
  KENYA_LOCATIONS,
  neighborhoodStorageValue,
  type KenyaLocation,
} from "@/data/kenya-locations";

export type LocationPlaceKind = "neighborhood" | "landmark" | "address" | "area" | "locality";

export type LocationSearchResult = {
  id: string;
  label: string;
  subtitle?: string;
  lat: number;
  lng: number;
  /** Kenya catalog storage value when applicable. */
  neighborhood?: string;
  source: "kenya" | "mapbox";
  kind: LocationPlaceKind;
};

/** Suggested search radius (km) when focusing the map on a place. */
export function placeFocusRadiusKm(kind: LocationPlaceKind): number {
  switch (kind) {
    case "landmark":
      return 2.5;
    case "address":
      return 1.5;
    case "neighborhood":
      return 3.5;
    case "locality":
    case "area":
    default:
      return 6;
  }
}

export function placeKindLabel(kind: LocationPlaceKind): string {
  switch (kind) {
    case "landmark":
      return "Landmark";
    case "address":
      return "Address";
    case "neighborhood":
      return "Neighborhood";
    case "locality":
      return "Town";
    case "area":
    default:
      return "Area";
  }
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

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
      subtitle: `${location.county} · neighborhood`,
      lat: location.lat,
      lng: location.lng,
      neighborhood: neighborhoodStorageValue(location),
      source: "kenya" as const,
      kind: "neighborhood" as const,
    }));
}

/** Nearby Kenya neighborhoods around a pin (Google Maps–style nearby areas). */
export function nearbyKenyaLocations(
  lat: number,
  lng: number,
  options?: { limit?: number; maxKm?: number; excludeName?: string },
): LocationSearchResult[] {
  const limit = options?.limit ?? 5;
  const maxKm = options?.maxKm ?? 8;
  const exclude = options?.excludeName?.trim().toLowerCase();

  return KENYA_LOCATIONS.map((location) => ({
    location,
    km: haversineKm(lat, lng, location.lat, location.lng),
  }))
    .filter((entry) => {
      if (entry.km > maxKm) return false;
      if (exclude && entry.location.name.toLowerCase() === exclude) return false;
      return true;
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map(({ location, km }) => ({
      id: `kenya-near:${location.county}:${location.name}`,
      label: location.name,
      subtitle: `${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} away · ${location.county}`,
      lat: location.lat,
      lng: location.lng,
      neighborhood: neighborhoodStorageValue(location),
      source: "kenya" as const,
      kind: "neighborhood" as const,
    }));
}

type MapboxContext = { id: string; text: string; short_code?: string };
type MapboxFeature = {
  id: string;
  place_name: string;
  text?: string;
  place_type?: string[];
  center: [number, number];
  context?: MapboxContext[];
};

function mapboxKind(types: string[] | undefined): LocationPlaceKind {
  if (!types?.length) return "area";
  if (types.includes("poi")) return "landmark";
  if (types.includes("address")) return "address";
  if (types.includes("neighborhood")) return "neighborhood";
  if (types.includes("locality")) return "locality";
  if (types.includes("place") || types.includes("district")) return "area";
  return "area";
}

function neighborhoodFromMapboxContext(context: MapboxContext[] | undefined): string | undefined {
  if (!context?.length) return undefined;
  const neighborhood = context.find((c) => c.id.startsWith("neighborhood"));
  if (neighborhood?.text) return neighborhood.text;
  const locality = context.find((c) => c.id.startsWith("locality"));
  return locality?.text;
}

export async function searchMapboxPlaces(
  query: string,
  token: string,
  limit = 6,
  proximity?: { lat: number; lng: number },
): Promise<LocationSearchResult[]> {
  const norm = query.trim();
  if (norm.length < 2) return [];

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(norm)}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "KE");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("language", "en");
  url.searchParams.set("autocomplete", "true");
  // Landmarks (POI), streets, estates, towns — Google Maps–style mix.
  url.searchParams.set("types", "poi,address,neighborhood,locality,place,district,region");
  const prox = proximity ?? { lat: -1.286389, lng: 36.817223 };
  url.searchParams.set("proximity", `${prox.lng},${prox.lat}`);
  // Soft bias to Kenya bounding box.
  url.searchParams.set("bbox", "33.9,-4.8,41.9,5.5");

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as { features?: MapboxFeature[] };
  return (data.features ?? []).map((feature) => {
    const kind = mapboxKind(feature.place_type);
    const neighborhood = neighborhoodFromMapboxContext(feature.context);
    const primary =
      feature.text?.trim() || feature.place_name.split(",")[0]?.trim() || feature.place_name;
    return {
      id: `mapbox:${feature.id}`,
      label: primary,
      subtitle: `${placeKindLabel(kind)} · ${feature.place_name}`,
      lat: feature.center[1],
      lng: feature.center[0],
      neighborhood: kind === "neighborhood" ? primary : neighborhood,
      source: "mapbox" as const,
      kind,
    };
  });
}

function isNear(a: LocationSearchResult, b: LocationSearchResult, epsilon = 0.002): boolean {
  return Math.abs(a.lat - b.lat) < epsilon && Math.abs(a.lng - b.lng) < epsilon;
}

export async function searchLocations(
  query: string,
  options?: {
    mapboxToken?: string | null;
    limit?: number;
    proximity?: { lat: number; lng: number };
  },
): Promise<LocationSearchResult[]> {
  const limit = options?.limit ?? 10;
  const local = searchKenyaLocations(query, Math.min(6, limit));

  const token = options?.mapboxToken?.trim();
  if (!token?.startsWith("pk.") || query.trim().length < 2) {
    return local.slice(0, limit);
  }

  try {
    const remote = await searchMapboxPlaces(
      query,
      token,
      Math.max(4, limit - Math.min(local.length, 3)),
      options?.proximity,
    );
    // Interleave: exact Kenya neighborhoods first, then landmarks/addresses from Mapbox.
    const merged: LocationSearchResult[] = [...local];
    for (const place of remote) {
      if (merged.some((existing) => isNear(existing, place) || existing.label === place.label)) {
        continue;
      }
      merged.push(place);
    }
    return merged.slice(0, limit);
  } catch {
    return local.slice(0, limit);
  }
}

export type MapPlaceFocus = {
  lat: number;
  lng: number;
  label: string;
  kind: LocationPlaceKind;
  radiusKm: number;
};

export function createPlaceFocus(place: LocationSearchResult): MapPlaceFocus {
  return {
    lat: place.lat,
    lng: place.lng,
    label: place.label,
    kind: place.kind,
    radiusKm: placeFocusRadiusKm(place.kind),
  };
}
