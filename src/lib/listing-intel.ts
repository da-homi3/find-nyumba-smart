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

  const daysSince = Math.floor(
    (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24),
  );

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
    verifiedDaysAgo: Math.max(1, daysSince || 1),
    borehole,
    gated,
    guard,
  };
}

export function formatVerifiedAgo(days: number) {
  if (days <= 1) return "Verified today";
  if (days < 7) return `Verified ${days} days ago`;
  if (days < 30) return `Verified ${Math.floor(days / 7)} wk ago`;
  return `Verified ${Math.floor(days / 30)} mo ago`;
}

export function verificationLevel(p: Property) {
  const score = p.authenticity_score ?? 70;
  if (!p.is_verified) return 0;
  if (score >= 90) return 4;
  if (score >= 75) return 3;
  if (score >= 60) return 2;
  return 1;
}
