import { matchLocation, neighborhoodStorageValue } from "@/data/kenya-locations";
import { haversineKm, nearbyKenyaLocations } from "@/lib/geo/location-search";
import { resolvePropertyMapCoords } from "@/lib/geo/property-map-coords";
import type { BrowseOrigin } from "@/lib/geo/tenant-browse-origin";

type ProximityListing = {
  id: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  featured_until?: string | null;
  created_at?: string;
};

const NEARBY_NEIGHBORHOOD_KM = 12;
const NEARBY_NEIGHBORHOOD_LIMIT = 12;

function listingNeighborhoodKey(neighborhood: string): string {
  const matched = matchLocation(neighborhood);
  return matched ? neighborhoodStorageValue(matched) : neighborhood.trim();
}

function isCurrentlyBoosted(featuredUntil: string | null | undefined, now: number): boolean {
  return Boolean(featuredUntil && new Date(featuredUntil).getTime() > now);
}

/**
 * Rank key for a listing relative to the tenant origin:
 * 0 = same/home neighborhood, 1..N = nearby neighborhoods by distance, large = farther areas.
 * Secondary key is straight-line distance to the listing pin/centroid.
 */
export function listingProximityRank(
  listing: ProximityListing,
  origin: BrowseOrigin,
  nearbyNeighborhoodKeys: ReadonlyMap<string, number>,
): { neighborhoodTier: number; distanceKm: number } {
  const coords = resolvePropertyMapCoords(listing);
  const distanceKm = haversineKm(origin.lat, origin.lng, coords.lat, coords.lng);
  const key = listingNeighborhoodKey(listing.neighborhood);

  if (origin.homeNeighborhood && key === origin.homeNeighborhood) {
    return { neighborhoodTier: 0, distanceKm };
  }

  const nearbyIndex = nearbyNeighborhoodKeys.get(key);
  if (nearbyIndex != null) {
    return { neighborhoodTier: 1 + nearbyIndex, distanceKm };
  }

  return { neighborhoodTier: 1_000 + Math.floor(distanceKm), distanceKm };
}

export function buildNearbyNeighborhoodRanks(
  origin: BrowseOrigin,
): ReadonlyMap<string, number> {
  const ranks = new Map<string, number>();
  const homeMatched = origin.homeNeighborhood
    ? matchLocation(origin.homeNeighborhood)
    : null;
  const nearby = nearbyKenyaLocations(origin.lat, origin.lng, {
    limit: NEARBY_NEIGHBORHOOD_LIMIT,
    maxKm: NEARBY_NEIGHBORHOOD_KM,
    excludeName: homeMatched?.name,
  });
  nearby.forEach((place, index) => {
    if (place.neighborhood) ranks.set(place.neighborhood, index);
  });
  return ranks;
}

/** Sort listings: boosted → home area → nearby neighborhoods → farther, then by distance. */
export function sortListingsByProximity<T extends ProximityListing>(
  items: T[],
  origin: BrowseOrigin,
  now: number = Date.now(),
): T[] {
  const nearbyRanks = buildNearbyNeighborhoodRanks(origin);

  return [...items].sort((a, b) => {
    const aBoost = isCurrentlyBoosted(a.featured_until, now) ? 1 : 0;
    const bBoost = isCurrentlyBoosted(b.featured_until, now) ? 1 : 0;
    if (aBoost !== bBoost) return bBoost - aBoost;

    const aRank = listingProximityRank(a, origin, nearbyRanks);
    const bRank = listingProximityRank(b, origin, nearbyRanks);
    if (aRank.neighborhoodTier !== bRank.neighborhoodTier) {
      return aRank.neighborhoodTier - bRank.neighborhoodTier;
    }
    if (aRank.distanceKm !== bRank.distanceKm) {
      return aRank.distanceKm - bRank.distanceKm;
    }

    const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
    const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
    return bCreated - aCreated;
  });
}
