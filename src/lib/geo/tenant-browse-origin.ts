import { neighborhoodCentroid } from "@/lib/geo/property-map-coords";
import { readStoredMapViewport } from "@/lib/mapbox/map-viewport-memory";
import { matchLocation, neighborhoodStorageValue } from "@/data/kenya-locations";
import { nearbyKenyaLocations } from "@/lib/geo/location-search";

export type BrowseOriginSource = "geolocation" | "neighborhood" | "map" | "default";

export type BrowseOrigin = {
  lat: number;
  lng: number;
  source: BrowseOriginSource;
  /** Closest catalog neighborhood to this origin, when known. */
  homeNeighborhood?: string;
};

const ORIGIN_STORAGE_KEY = "nyumba-browse-origin";

/** Nairobi CBD — last-resort browse center. */
export const DEFAULT_BROWSE_ORIGIN: BrowseOrigin = {
  lat: -1.286389,
  lng: 36.817223,
  source: "default",
  homeNeighborhood: "Nairobi",
};

export function readStoredBrowseOrigin(): BrowseOrigin | null {
  if (globalThis.sessionStorage === undefined) return null;
  try {
    const raw = sessionStorage.getItem(ORIGIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrowseOrigin;
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) return null;
    if (parsed.source !== "geolocation") return null;
    return {
      lat: parsed.lat,
      lng: parsed.lng,
      source: "geolocation",
      homeNeighborhood: parsed.homeNeighborhood,
    };
  } catch {
    return null;
  }
}

export function writeStoredBrowseOrigin(origin: BrowseOrigin): void {
  if (globalThis.sessionStorage === undefined) return;
  if (origin.source !== "geolocation") return;
  try {
    sessionStorage.setItem(ORIGIN_STORAGE_KEY, JSON.stringify(origin));
  } catch {
    // ignore
  }
}

export function homeNeighborhoodForCoords(lat: number, lng: number): string | undefined {
  const nearest = nearbyKenyaLocations(lat, lng, { limit: 1, maxKm: 25 })[0];
  return nearest?.neighborhood;
}

export function browseOriginFromNeighborhood(neighborhood: string): BrowseOrigin | null {
  if (!neighborhood || neighborhood === "All") return null;
  const matched = matchLocation(neighborhood);
  const centroid = neighborhoodCentroid(neighborhood);
  if (!centroid) return null;
  return {
    lat: centroid.lat,
    lng: centroid.lng,
    source: "neighborhood",
    homeNeighborhood: matched ? neighborhoodStorageValue(matched) : neighborhood,
  };
}

/** Resolve browse origin without waiting on geolocation. */
export function resolveBrowseOriginFallback(neighborhoodFilter?: string): BrowseOrigin {
  const fromFilter = neighborhoodFilter
    ? browseOriginFromNeighborhood(neighborhoodFilter)
    : null;
  if (fromFilter) return fromFilter;

  const storedGeo = readStoredBrowseOrigin();
  if (storedGeo) return storedGeo;

  const mapViewport = readStoredMapViewport();
  if (mapViewport) {
    return {
      lat: mapViewport.lat,
      lng: mapViewport.lng,
      source: "map",
      homeNeighborhood: homeNeighborhoodForCoords(mapViewport.lat, mapViewport.lng),
    };
  }

  return DEFAULT_BROWSE_ORIGIN;
}

export function browseOriginFromGeolocation(lat: number, lng: number): BrowseOrigin {
  return {
    lat,
    lng,
    source: "geolocation",
    homeNeighborhood: homeNeighborhoodForCoords(lat, lng),
  };
}
