/**
 * Location match tiers: inside | near | marketed_as
 * Used by listings ranking and recommendations.
 */
import { haversineKm, normalizeLocationName } from "@/lib/locations/normalize";

export type LocationMatchTier = "inside" | "near" | "marketed_as" | "none";

export type TierScoreInput = {
  /** Resolved filter location id (preferred). */
  filterLocationId?: string | null;
  filterNeighborhood?: string | null;
  property: {
    location_id?: string | null;
    ward_location_id?: string | null;
    constituency_location_id?: string | null;
    county_location_id?: string | null;
    neighborhood?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  /** Optional filter centroid for near-tier distance. */
  filterLat?: number | null;
  filterLng?: number | null;
  /** km radius for "near" (default 5). */
  nearKm?: number;
};

const TIER_RANK: Record<LocationMatchTier, number> = {
  inside: 3,
  near: 2,
  marketed_as: 1,
  none: 0,
};

export function tierRank(tier: LocationMatchTier): number {
  return TIER_RANK[tier] ?? 0;
}

/** Classify how a listing relates to the active place filter. */
export function classifyLocationMatch(input: TierScoreInput): LocationMatchTier {
  const {
    filterLocationId,
    filterNeighborhood,
    property,
    filterLat,
    filterLng,
    nearKm = 5,
  } = input;

  if (filterLocationId) {
    const ids = [
      property.location_id,
      property.ward_location_id,
      property.constituency_location_id,
      property.county_location_id,
    ].filter(Boolean);
    if (ids.includes(filterLocationId)) return "inside";
  }

  const hood = normalizeLocationName(property.neighborhood ?? "");
  const filterHood = normalizeLocationName(filterNeighborhood ?? "");
  if (hood && filterHood && (hood === filterHood || hood.includes(filterHood) || filterHood.includes(hood))) {
    // Text match without FK — marketed-as (landlord wrote the name)
    if (!filterLocationId || property.location_id !== filterLocationId) {
      return "marketed_as";
    }
    return "inside";
  }

  if (
    filterLat != null &&
    filterLng != null &&
    property.latitude != null &&
    property.longitude != null &&
    Number.isFinite(filterLat) &&
    Number.isFinite(filterLng) &&
    Number.isFinite(property.latitude) &&
    Number.isFinite(property.longitude)
  ) {
    const km = haversineKm(filterLat, filterLng, property.latitude, property.longitude);
    if (km <= nearKm) return "near";
  }

  return "none";
}

/** Sort comparator: inside > near > marketed_as > none, then distance, then authenticity. */
export function compareByLocationTier(
  a: { tier: LocationMatchTier; distanceKm?: number; authenticity?: number },
  b: { tier: LocationMatchTier; distanceKm?: number; authenticity?: number },
): number {
  const tr = tierRank(b.tier) - tierRank(a.tier);
  if (tr !== 0) return tr;
  const da = a.distanceKm ?? 9999;
  const db = b.distanceKm ?? 9999;
  if (da !== db) return da - db;
  return (b.authenticity ?? 0) - (a.authenticity ?? 0);
}
