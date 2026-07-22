import { differenceInCalendarDays, startOfDay } from "date-fns";
import type { Property } from "@/lib/properties";
import { getAreaProfile, type ReliabilityLabel } from "@/lib/area-analysis";

export type { ReliabilityLabel };

export type ListingIntel = {
  subArea: string;
  water: ReliabilityLabel;
  security: ReliabilityLabel;
  internet: boolean;
  internetProviders: string[];
  parking: boolean;
  noise: "Low" | "Moderate" | "High";
  matatuRoute: string;
  commuteCbdMins: number;
  verifiedDaysAgo: number;
  borehole: boolean;
  gated: boolean;
  guard: boolean;
};

function verificationTimestamp(p: Property): string | null {
  if (p.nyumba_verified_at) return p.nyumba_verified_at;
  if (p.is_verified) return p.updated_at;
  return null;
}

/** Tenant-facing verified badge text (no relative timing). */
export function formatVerifiedAt(_iso?: string | Date, _now = new Date()): string {
  return "Verified";
}

export function propertyVerifiedLabel(p: Property): string | null {
  if (!verificationTimestamp(p)) return null;
  return "Verified";
}

/**
 * Tenant-facing area intel derived from neighborhood profiles + listing amenities.
 * Prefer stored health_score / authenticity_score on the property for badges.
 */
export function getListingIntel(p: Property): ListingIntel {
  const profile = getAreaProfile(p.neighborhood);
  const amenities = p.amenities ?? [];
  const parking = amenities.some((a) => /park/i.test(a));
  const borehole = amenities.some((a) => /borehole|water|tank/i.test(a));
  const gated = amenities.some((a) => /gated|security/i.test(a)) || p.is_verified;
  const guard = amenities.some((a) => /guard|cctv|security/i.test(a));

  const verifiedAt = verificationTimestamp(p);
  const daysSinceVerified = verifiedAt
    ? differenceInCalendarDays(startOfDay(new Date()), startOfDay(new Date(verifiedAt)))
    : 0;

  // Slight amenity upgrades on top of area baseline (deterministic, no random hash)
  let water = profile.water;
  let security = profile.security;
  if (borehole && water === "Poor") water = "Moderate";
  if (borehole && water === "Moderate") water = "Good";
  if ((gated || guard) && security === "Poor") security = "Moderate";
  if ((gated || guard) && security === "Moderate") security = "Good";

  return {
    subArea: profile.subAreas[0] ?? profile.areaKey,
    water,
    security,
    internet: profile.internetProviders.length > 0,
    internetProviders: profile.internetProviders,
    parking,
    noise: profile.noise,
    matatuRoute: profile.matatuRoute,
    commuteCbdMins: profile.commuteCbdMins,
    verifiedDaysAgo: Math.max(0, daysSinceVerified),
    borehole,
    gated,
    guard,
  };
}

/** @deprecated Prefer `formatVerifiedAt` or `propertyVerifiedLabel`. */
export function formatVerifiedAgo(_days: number) {
  return "Verified";
}

export function verificationLevel(p: Property) {
  const score = p.authenticity_score ?? 70;
  if (!p.is_verified) return 0;
  if (score >= 90) return 4;
  if (score >= 75) return 3;
  if (score >= 60) return 2;
  return 1;
}
