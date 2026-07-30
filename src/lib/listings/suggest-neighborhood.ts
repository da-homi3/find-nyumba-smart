import { homeNeighborhoodForCoords } from "@/lib/geo/tenant-browse-origin";
import { nearbyKenyaLocations } from "@/lib/geo/location-search";
import { reverseGeocodeNairobi } from "@/lib/whatsapp/geocode";
import { matchLocation, neighborhoodStorageValue } from "@/data/kenya-locations";

export type NeighborhoodSuggestion = {
  neighborhood: string;
  source: "catalog" | "bbox" | "ai";
  confidence: "high" | "medium" | "low";
  alternatives: string[];
};

/**
 * Instant neighborhood from map pin — nearest Kenya catalog location,
 * with Nairobi bbox fallback for dense central areas.
 */
export function suggestNeighborhoodFromCoords(
  lat: number,
  lng: number,
): NeighborhoodSuggestion | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const nearby = nearbyKenyaLocations(lat, lng, { limit: 4, maxKm: 25 });
  const nearest = nearby[0];
  const catalog = homeNeighborhoodForCoords(lat, lng) ?? nearest?.neighborhood;
  const bbox = reverseGeocodeNairobi(lat, lng);

  if (catalog) {
    const km = nearest?.distanceKm ?? 99;
    return {
      neighborhood: catalog,
      source: "catalog",
      confidence: km <= 3 ? "high" : km <= 8 ? "medium" : "low",
      alternatives: nearby
        .slice(1)
        .map((n) => n.neighborhood)
        .filter((v): v is string => Boolean(v)),
    };
  }

  if (bbox) {
    const matched = matchLocation(bbox);
    return {
      neighborhood: matched ? neighborhoodStorageValue(matched) : bbox,
      source: "bbox",
      confidence: "medium",
      alternatives: [],
    };
  }

  return null;
}

/** Normalize an AI / free-text neighborhood guess against the Kenya catalog. */
export function resolveSuggestedNeighborhoodLabel(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const matched = matchLocation(trimmed);
  if (matched) return neighborhoodStorageValue(matched);
  return trimmed.length >= 2 ? trimmed : null;
}
