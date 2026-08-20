import type { LocationsDb } from "./db";
import { resolveLocation } from "./resolve";
import { reverseGeocode } from "./reverse-geocode";
import { getLocationAncestors } from "./hierarchy";
import type { LocationType } from "./types";

export type PropertyLocationMatch = {
  location_id: string | null;
  county_location_id: string | null;
  constituency_location_id: string | null;
  ward_location_id: string | null;
  location_match_confidence: number | null;
  location_needs_review: boolean;
  matched_name: string | null;
};

function pickAncestor(
  ancestors: { id: string; type: LocationType }[],
  type: LocationType,
): string | null {
  return ancestors.find((a) => a.type === type)?.id ?? null;
}

/**
 * Map free-text neighborhood (+ optional coords) onto location FKs.
 * Never mutates the original neighborhood string.
 */
export async function matchPropertyLocation(
  supabase: LocationsDb,
  input: {
    neighborhood?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
): Promise<PropertyLocationMatch> {
  const empty: PropertyLocationMatch = {
    location_id: null,
    county_location_id: null,
    constituency_location_id: null,
    ward_location_id: null,
    location_match_confidence: null,
    location_needs_review: false,
    matched_name: null,
  };

  const neighborhood = input.neighborhood?.trim();
  const hasCoords =
    input.latitude != null &&
    input.longitude != null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude);

  let resolved = neighborhood
    ? await resolveLocation(supabase, neighborhood, {
        lat: input.latitude ?? undefined,
        lng: input.longitude ?? undefined,
      })
    : null;

  if (hasCoords && (!resolved || resolved.needsReview || resolved.matchConfidence < 70)) {
    const rev = await reverseGeocode(supabase, input.latitude!, input.longitude!);
    if (rev.locality && (!resolved || resolved.matchConfidence < 60)) {
      const ancestors = await getLocationAncestors(supabase, rev.locality.id);
      resolved = {
        ...rev.locality,
        ancestors,
        matchConfidence: Math.min(rev.confidence, 68),
        needsReview: true,
      };
    } else if (resolved && rev.county) {
      const countyAncestor = resolved.ancestors.find((a) => a.type === "COUNTY");
      if (countyAncestor && countyAncestor.id !== rev.county.id) {
        resolved = {
          ...resolved,
          needsReview: true,
          matchConfidence: Math.min(resolved.matchConfidence, 55),
        };
      }
    }
  }

  if (!resolved) {
    return { ...empty, location_needs_review: Boolean(neighborhood) };
  }

  const ancestors = resolved.ancestors.map((a) => ({ id: a.id, type: a.type }));
  const selfType = resolved.type;
  const countyId = selfType === "COUNTY" ? resolved.id : pickAncestor(ancestors, "COUNTY");
  const constituencyId =
    selfType === "CONSTITUENCY" ? resolved.id : pickAncestor(ancestors, "CONSTITUENCY");
  const wardId = selfType === "WARD" ? resolved.id : pickAncestor(ancestors, "WARD");

  return {
    location_id: resolved.id,
    county_location_id: countyId,
    constituency_location_id: constituencyId,
    ward_location_id: wardId,
    location_match_confidence: resolved.matchConfidence,
    location_needs_review: resolved.needsReview,
    matched_name: resolved.name,
  };
}
