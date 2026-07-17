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
  /** Optional Mapbox Search Box id for retrieve (when using suggest flow). */
  mapboxId?: string;
  /** Distance from search proximity in km, when known. */
  distanceKm?: number;
};

export type SearchViewport = {
  proximity?: { lat: number; lng: number };
  /** minLng, minLat, maxLng, maxLat — soft bias / hard limit for Mapbox. */
  bbox?: [number, number, number, number];
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

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Cheap edit-distance for typo-tolerant Kenya catalog matching. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prevDiag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, prevDiag + cost);
      prevDiag = temp;
    }
  }
  return prev[b.length]!;
}

function typoScore(name: string, norm: string): number {
  if (norm.length < 4 || Math.min(name.length, norm.length) < 4) return 0;
  const dist = editDistance(name.slice(0, Math.max(norm.length + 1, name.length)), norm);
  if (dist === 1) return 68;
  if (dist === 2 && norm.length >= 6) return 55;
  return 0;
}

function scoreKenyaLocation(location: KenyaLocation, norm: string): number {
  const name = location.name.toLowerCase();
  const county = location.county.toLowerCase();
  const label = neighborhoodStorageValue(location).toLowerCase();
  const tokens = norm.split(/\s+/).filter(Boolean);

  if (name === norm || label === norm) return 100;
  if (name.startsWith(norm)) return 92;
  if (label.startsWith(norm)) return 88;
  if (name.includes(norm)) return 75;
  if (label.includes(norm)) return 70;

  const typo = typoScore(name, norm);
  if (typo > 0) return typo;

  if (tokens.length > 1 && tokens.every((t) => name.includes(t) || label.includes(t))) return 72;
  if (county.startsWith(norm)) return 40;
  if (county.includes(norm) && name.includes(tokens[0] ?? norm)) return 50;
  return 0;
}

export function searchKenyaLocations(
  query: string,
  limit = 8,
  proximity?: { lat: number; lng: number },
): LocationSearchResult[] {
  const norm = query.trim().toLowerCase();
  if (norm.length < 2) return [];

  return KENYA_LOCATIONS.map((location) => {
    const score = scoreKenyaLocation(location, norm);
    const distanceKm = proximity
      ? haversineKm(proximity.lat, proximity.lng, location.lat, location.lng)
      : undefined;
    // Prefer nearer matches when scores are close (Google Maps–style ranking).
    const proximityBoost =
      distanceKm == null ? 0 : Math.max(0, 12 - Math.min(12, distanceKm / 2));
    return { location, score: score + (score > 0 ? proximityBoost : 0), distanceKm };
  })
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.distanceKm ?? 999) - (b.distanceKm ?? 999) ||
        a.location.name.localeCompare(b.location.name),
    )
    .slice(0, limit)
    .map(({ location, distanceKm }) => ({
      id: `kenya:${location.county}:${location.name}`,
      label: location.name,
      subtitle: `${location.county} · neighborhood`,
      lat: location.lat,
      lng: location.lng,
      neighborhood: neighborhoodStorageValue(location),
      source: "kenya" as const,
      kind: "neighborhood" as const,
      distanceKm,
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
      subtitle: `${formatDistanceKm(km)} away · ${location.county}`,
      lat: location.lat,
      lng: location.lng,
      neighborhood: neighborhoodStorageValue(location),
      source: "kenya" as const,
      kind: "neighborhood" as const,
      distanceKm: km,
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

type SearchBoxFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    mapbox_id?: string;
    name?: string;
    name_preferred?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
    context?: {
      neighborhood?: { name?: string };
      locality?: { name?: string };
      place?: { name?: string };
    };
  };
};

function mapboxKind(types: string[] | undefined): LocationPlaceKind {
  if (!types?.length) return "area";
  if (types.includes("poi")) return "landmark";
  if (types.includes("address") || types.includes("street")) return "address";
  if (types.includes("neighborhood")) return "neighborhood";
  if (types.includes("locality") || types.includes("city")) return "locality";
  if (types.includes("place") || types.includes("district") || types.includes("region")) return "area";
  return "area";
}

function searchBoxKind(featureType: string | undefined): LocationPlaceKind {
  if (!featureType) return "area";
  if (featureType === "poi") return "landmark";
  if (featureType === "address" || featureType === "street") return "address";
  if (featureType === "neighborhood") return "neighborhood";
  if (featureType === "locality" || featureType === "city") return "locality";
  return "area";
}

function neighborhoodFromMapboxContext(context: MapboxContext[] | undefined): string | undefined {
  if (!context?.length) return undefined;
  const neighborhood = context.find((c) => c.id.startsWith("neighborhood"));
  if (neighborhood?.text) return neighborhood.text;
  const locality = context.find((c) => c.id.startsWith("locality"));
  return locality?.text;
}

const KENYA_BBOX = "33.9,-4.8,41.9,5.5";
const NAIROBI_CBD = { lat: -1.286389, lng: 36.817223 };

function applySearchParams(
  url: URL,
  token: string,
  limit: number,
  viewport?: SearchViewport,
) {
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "KE");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("language", "en");
  const prox = viewport?.proximity ?? NAIROBI_CBD;
  url.searchParams.set("proximity", `${prox.lng},${prox.lat}`);
  if (viewport?.bbox) {
    url.searchParams.set("bbox", viewport.bbox.join(","));
  } else {
    url.searchParams.set("bbox", KENYA_BBOX);
  }
}

/** Mapbox Search Box forward + autocomplete — Google Maps–quality POI/address ranking. */
export async function searchMapboxSearchBox(
  query: string,
  token: string,
  limit = 6,
  viewport?: SearchViewport,
): Promise<LocationSearchResult[]> {
  const norm = query.trim();
  if (norm.length < 2) return [];

  const url = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
  url.searchParams.set("q", norm);
  url.searchParams.set("auto_complete", "true");
  url.searchParams.set(
    "types",
    "poi,address,street,neighborhood,locality,place,city,district,region",
  );
  applySearchParams(url, token, limit, viewport);

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as { features?: SearchBoxFeature[] };
  const prox = viewport?.proximity ?? NAIROBI_CBD;

  return (data.features ?? [])
    .map((feature) => {
      const props = feature.properties ?? {};
      const kind = searchBoxKind(props.feature_type);
      const [lng, lat] = feature.geometry.coordinates;
      const primary =
        props.name_preferred?.trim() || props.name?.trim() || props.full_address?.trim() || "Place";
      const placeFormatted = props.place_formatted || props.full_address || "";
      const neighborhood =
        kind === "neighborhood"
          ? primary
          : props.context?.neighborhood?.name || props.context?.locality?.name;
      const distanceKm = haversineKm(prox.lat, prox.lng, lat, lng);
      return {
        id: `mapbox-sb:${props.mapbox_id ?? String(lng) + "," + String(lat)}`,
        label: primary,
        subtitle: placeFormatted
          ? `${placeKindLabel(kind)} · ${placeFormatted}`
          : placeKindLabel(kind),
        lat,
        lng,
        neighborhood,
        source: "mapbox" as const,
        kind,
        mapboxId: props.mapbox_id,
        distanceKm,
      };
    })
    .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng));
}

/** Legacy Geocoding v5 — fallback when Search Box is unavailable. */
export async function searchMapboxPlaces(
  query: string,
  token: string,
  limit = 6,
  proximity?: { lat: number; lng: number },
  bbox?: [number, number, number, number],
): Promise<LocationSearchResult[]> {
  const norm = query.trim();
  if (norm.length < 2) return [];

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(norm)}.json`,
  );
  applySearchParams(url, token, limit, { proximity, bbox });
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("types", "poi,address,neighborhood,locality,place,district,region");

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as { features?: MapboxFeature[] };
  const prox = proximity ?? NAIROBI_CBD;
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
      distanceKm: haversineKm(prox.lat, prox.lng, feature.center[1], feature.center[0]),
    };
  });
}

function isNear(a: LocationSearchResult, b: LocationSearchResult, epsilon = 0.002): boolean {
  return Math.abs(a.lat - b.lat) < epsilon && Math.abs(a.lng - b.lng) < epsilon;
}

function rankMergedResults(
  places: LocationSearchResult[],
  query: string,
  proximity?: { lat: number; lng: number },
): LocationSearchResult[] {
  const norm = query.trim().toLowerCase();
  return [...places].sort((a, b) => {
    const aExact = a.label.toLowerCase() === norm || a.neighborhood?.toLowerCase() === norm;
    const bExact = b.label.toLowerCase() === norm || b.neighborhood?.toLowerCase() === norm;
    if (aExact !== bExact) return aExact ? -1 : 1;

    const aPrefix = a.label.toLowerCase().startsWith(norm);
    const bPrefix = b.label.toLowerCase().startsWith(norm);
    if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;

    // Prefer curated Kenya neighborhoods slightly over remote POIs at equal distance.
    const aKenya = a.source === "kenya" ? 1 : 0;
    const bKenya = b.source === "kenya" ? 1 : 0;
    if (aKenya !== bKenya && Math.abs((a.distanceKm ?? 50) - (b.distanceKm ?? 50)) < 3) {
      return bKenya - aKenya;
    }

    const aDist =
      a.distanceKm ??
      (proximity ? haversineKm(proximity.lat, proximity.lng, a.lat, a.lng) : 999);
    const bDist =
      b.distanceKm ??
      (proximity ? haversineKm(proximity.lat, proximity.lng, b.lat, b.lng) : 999);
    return aDist - bDist || a.label.localeCompare(b.label);
  });
}

export async function searchLocations(
  query: string,
  options?: {
    mapboxToken?: string | null;
    limit?: number;
    proximity?: { lat: number; lng: number };
    bbox?: [number, number, number, number];
  },
): Promise<LocationSearchResult[]> {
  const limit = options?.limit ?? 10;
  const viewport: SearchViewport = {
    proximity: options?.proximity,
    bbox: options?.bbox,
  };
  const local = searchKenyaLocations(query, Math.min(6, limit), options?.proximity);

  const token = options?.mapboxToken?.trim();
  if (!token?.startsWith("pk.") || query.trim().length < 2) {
    return rankMergedResults(local, query, options?.proximity).slice(0, limit);
  }

  try {
    const remoteLimit = Math.max(5, limit - Math.min(local.length, 2));
    let remote = await searchMapboxSearchBox(query, token, remoteLimit, viewport);
    if (remote.length === 0) {
      remote = await searchMapboxPlaces(
        query,
        token,
        remoteLimit,
        options?.proximity,
        options?.bbox,
      );
    }

    const merged: LocationSearchResult[] = [...local];
    for (const place of remote) {
      if (merged.some((existing) => isNear(existing, place) || existing.label === place.label)) {
        continue;
      }
      merged.push(place);
    }
    return rankMergedResults(merged, query, options?.proximity).slice(0, limit);
  } catch {
    return rankMergedResults(local, query, options?.proximity).slice(0, limit);
  }
}

/** Resolve free-text into the best place (Enter key / voice / deep link). */
export async function resolveBestLocation(
  query: string,
  options?: {
    mapboxToken?: string | null;
    proximity?: { lat: number; lng: number };
    bbox?: [number, number, number, number];
  },
): Promise<LocationSearchResult | null> {
  const results = await searchLocations(query, { ...options, limit: 5 });
  return results[0] ?? null;
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
