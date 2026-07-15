import { matchNeighborhood } from "@/data/nairobi-neighborhoods";
import { NEIGHBORHOOD_COORDS } from "@/lib/geo/property-map-coords";

export type ReliabilityLabel = "Poor" | "Moderate" | "Good" | "Excellent";

export type AreaProfile = {
  water: ReliabilityLabel;
  security: ReliabilityLabel;
  electricity: ReliabilityLabel;
  internetProviders: string[];
  matatuRoute: string;
  commuteCbdMins: number;
  noise: "Low" | "Moderate" | "High";
  subAreas: string[];
};

/** Nairobi area profiles used for automatic listing stats. */
export const AREA_PROFILES: Record<string, AreaProfile> = {
  Kilimani: {
    water: "Good",
    security: "Excellent",
    electricity: "Good",
    internetProviders: ["Safaricom", "Zuku", "Faiba"],
    matatuRoute: "Route 48 / 46",
    commuteCbdMins: 25,
    noise: "Moderate",
    subAreas: ["Argwings Kodhek", "Yaya", "Dennis Pritt"],
  },
  Westlands: {
    water: "Moderate",
    security: "Good",
    electricity: "Good",
    internetProviders: ["Safaricom", "Zuku"],
    matatuRoute: "Route 11 / 106",
    commuteCbdMins: 20,
    noise: "High",
    subAreas: ["Parklands", "Highridge", "Sarit"],
  },
  Karen: {
    water: "Good",
    security: "Excellent",
    electricity: "Excellent",
    internetProviders: ["Safaricom", "Zuku"],
    matatuRoute: "Route 24",
    commuteCbdMins: 40,
    noise: "Low",
    subAreas: ["Karen Road", "Langata South"],
  },
  Lavington: {
    water: "Excellent",
    security: "Excellent",
    electricity: "Excellent",
    internetProviders: ["Safaricom", "Zuku", "Faiba"],
    matatuRoute: "Route 48",
    commuteCbdMins: 22,
    noise: "Low",
    subAreas: ["James Gichuru", "Valley Arcade"],
  },
  Kileleshwa: {
    water: "Good",
    security: "Excellent",
    electricity: "Good",
    internetProviders: ["Safaricom", "Zuku", "Faiba"],
    matatuRoute: "Route 46",
    commuteCbdMins: 20,
    noise: "Moderate",
    subAreas: ["Oloitokitok", "Riverside"],
  },
  Kasarani: {
    water: "Moderate",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom", "Faiba"],
    matatuRoute: "Route 17 / 45",
    commuteCbdMins: 45,
    noise: "Moderate",
    subAreas: ["Mwiki", "Royale", "Garden Estate"],
  },
  "South B": {
    water: "Good",
    security: "Good",
    electricity: "Good",
    internetProviders: ["Safaricom", "Zuku"],
    matatuRoute: "Route 12",
    commuteCbdMins: 30,
    noise: "Moderate",
    subAreas: ["South C border", "Mugoya", "Ole Sereni"],
  },
  "South C": {
    water: "Good",
    security: "Good",
    electricity: "Good",
    internetProviders: ["Safaricom", "Zuku", "Faiba"],
    matatuRoute: "Route 33",
    commuteCbdMins: 28,
    noise: "Moderate",
    subAreas: ["Bellevue", "Mugoya"],
  },
  Roysambu: {
    water: "Moderate",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom"],
    matatuRoute: "Route 145",
    commuteCbdMins: 40,
    noise: "Moderate",
    subAreas: ["Roysambu Roundabout", "Zimmerman border"],
  },
  Embakasi: {
    water: "Moderate",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom", "Faiba"],
    matatuRoute: "Route 34",
    commuteCbdMins: 50,
    noise: "High",
    subAreas: ["Pipeline", "Fedha", "Tassia"],
  },
  Parklands: {
    water: "Good",
    security: "Good",
    electricity: "Good",
    internetProviders: ["Safaricom", "Zuku"],
    matatuRoute: "Route 11",
    commuteCbdMins: 18,
    noise: "Moderate",
    subAreas: ["Highridge", "Mpaka Road"],
  },
  "Ngong Road": {
    water: "Good",
    security: "Good",
    electricity: "Good",
    internetProviders: ["Safaricom", "Zuku"],
    matatuRoute: "Route 111",
    commuteCbdMins: 30,
    noise: "High",
    subAreas: ["Prestige", "Junction"],
  },
  Ruaraka: {
    water: "Moderate",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom"],
    matatuRoute: "Route 25",
    commuteCbdMins: 35,
    noise: "Moderate",
    subAreas: ["Baba Dogo", "Lucky Summer"],
  },
  Donholm: {
    water: "Moderate",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom", "Faiba"],
    matatuRoute: "Route 19",
    commuteCbdMins: 40,
    noise: "Moderate",
    subAreas: ["Phase 5", "Greenfields"],
  },
  Buruburu: {
    water: "Good",
    security: "Good",
    electricity: "Good",
    internetProviders: ["Safaricom", "Zuku"],
    matatuRoute: "Route 58",
    commuteCbdMins: 35,
    noise: "Moderate",
    subAreas: ["Phase 1", "Phase 4"],
  },
  Langata: {
    water: "Good",
    security: "Good",
    electricity: "Good",
    internetProviders: ["Safaricom", "Zuku"],
    matatuRoute: "Route 24",
    commuteCbdMins: 35,
    noise: "Low",
    subAreas: ["Nairobi West", "Madaraka"],
  },
  Runda: {
    water: "Excellent",
    security: "Excellent",
    electricity: "Excellent",
    internetProviders: ["Safaricom", "Zuku", "Faiba"],
    matatuRoute: "Private / Route 106",
    commuteCbdMins: 30,
    noise: "Low",
    subAreas: ["Old Runda", "Muringa"],
  },
  Gigiri: {
    water: "Excellent",
    security: "Excellent",
    electricity: "Excellent",
    internetProviders: ["Safaricom", "Zuku"],
    matatuRoute: "Route 106",
    commuteCbdMins: 28,
    noise: "Low",
    subAreas: ["UN Avenue", "Village Market"],
  },
  Hurlingham: {
    water: "Good",
    security: "Good",
    electricity: "Good",
    internetProviders: ["Safaricom", "Zuku"],
    matatuRoute: "Route 46",
    commuteCbdMins: 18,
    noise: "Moderate",
    subAreas: ["Argwings", "Kirichwa"],
  },
  "Upper Hill": {
    water: "Good",
    security: "Good",
    electricity: "Excellent",
    internetProviders: ["Safaricom", "Zuku", "Faiba"],
    matatuRoute: "Route 33",
    commuteCbdMins: 12,
    noise: "High",
    subAreas: ["Hospital Road", "Elgon Road"],
  },
  CBD: {
    water: "Moderate",
    security: "Moderate",
    electricity: "Good",
    internetProviders: ["Safaricom", "Faiba"],
    matatuRoute: "All routes",
    commuteCbdMins: 5,
    noise: "High",
    subAreas: ["Tom Mboya", "Moi Avenue"],
  },
  Eastleigh: {
    water: "Moderate",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom"],
    matatuRoute: "Route 9",
    commuteCbdMins: 20,
    noise: "High",
    subAreas: ["Section 1", "Section 3"],
  },
  Zimmerman: {
    water: "Moderate",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom", "Faiba"],
    matatuRoute: "Route 44",
    commuteCbdMins: 45,
    noise: "Moderate",
    subAreas: ["Githurai border", "Roysambu"],
  },
  "Thika Road": {
    water: "Moderate",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom", "Faiba"],
    matatuRoute: "Route 145 / 17",
    commuteCbdMins: 40,
    noise: "High",
    subAreas: ["TRM", "Garden City"],
  },
  Ruaka: {
    water: "Moderate",
    security: "Good",
    electricity: "Good",
    internetProviders: ["Safaricom", "Faiba"],
    matatuRoute: "Route 237",
    commuteCbdMins: 50,
    noise: "Moderate",
    subAreas: ["Ruaka Town", "Ndenderu", "Two Rivers"],
  },
  Ruiru: {
    water: "Moderate",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom"],
    matatuRoute: "Route 145",
    commuteCbdMins: 55,
    noise: "Moderate",
    subAreas: ["Ruiru Town", "Membley"],
  },
  Rongai: {
    water: "Poor",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom"],
    matatuRoute: "Route 126",
    commuteCbdMins: 75,
    noise: "Moderate",
    subAreas: ["Tuskys area", "Maasai Lodge", "Kware"],
  },
  Tumaini: {
    water: "Moderate",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom"],
    matatuRoute: "Route 126",
    commuteCbdMins: 70,
    noise: "Moderate",
    subAreas: ["Tumaini Stage", "Ongata Rongai"],
  },
  Umoja: {
    water: "Moderate",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom", "Faiba"],
    matatuRoute: "Route 19",
    commuteCbdMins: 40,
    noise: "Moderate",
    subAreas: ["Umoja 1", "Umoja Innercore"],
  },
  Nairobi: {
    water: "Moderate",
    security: "Moderate",
    electricity: "Moderate",
    internetProviders: ["Safaricom"],
    matatuRoute: "CBD matatu",
    commuteCbdMins: 40,
    noise: "Moderate",
    subAreas: ["Central"],
  },
};

const LABEL_SCORE: Record<ReliabilityLabel, number> = {
  Poor: 1,
  Moderate: 2,
  Good: 3,
  Excellent: 4,
};

function labelFromScore(n: number): ReliabilityLabel {
  if (n >= 3.5) return "Excellent";
  if (n >= 2.5) return "Good";
  if (n >= 1.5) return "Moderate";
  return "Poor";
}

export function resolveAreaKey(neighborhood: string): string {
  const matched = matchNeighborhood(neighborhood);
  if (matched && (AREA_PROFILES[matched] || NEIGHBORHOOD_COORDS[matched])) return matched;

  const norm = neighborhood.trim().toLowerCase();
  if (!norm) return "Nairobi";

  for (const key of Object.keys(AREA_PROFILES)) {
    const keyNorm = key.toLowerCase();
    if (keyNorm === norm || norm.includes(keyNorm) || keyNorm.includes(norm)) return key;
  }
  for (const key of Object.keys(NEIGHBORHOOD_COORDS)) {
    const keyNorm = key.toLowerCase();
    if (keyNorm === norm || norm.includes(keyNorm) || keyNorm.includes(norm)) return key;
  }
  return "Nairobi";
}

export function getAreaProfile(neighborhood: string): AreaProfile & { areaKey: string } {
  const areaKey = resolveAreaKey(neighborhood);
  const profile = AREA_PROFILES[areaKey] ?? AREA_PROFILES.Nairobi;
  return { ...profile, areaKey };
}

type PropertyAnalysisInput = {
  neighborhood: string;
  amenities?: string[] | null;
  images?: string[] | null;
  video_url?: string | null;
  tour_url?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  area_sqm?: number | null;
  rent_kes: number;
  bedrooms: number;
  bathrooms: number;
  is_verified?: boolean;
  address?: string | null;
};

export type PropertyAreaAnalysis = {
  areaKey: string;
  water: ReliabilityLabel;
  security: ReliabilityLabel;
  electricity: ReliabilityLabel;
  internetProviders: string[];
  matatuRoute: string;
  commuteCbdMins: number;
  noise: "Low" | "Moderate" | "High";
  subArea: string;
  healthScore: number;
  authenticityScore: number;
  rentVsAreaMedianPct: number | null;
  areaMedianRent: number | null;
  areaListingCount: number;
};

function amenityBoost(amenities: string[], pattern: RegExp, amount: number): number {
  return amenities.some((a) => pattern.test(a)) ? amount : 0;
}

function capScore(n: number, boost: number): number {
  return Math.min(4, n + boost);
}

function accessibilityScoreFromCommute(commuteCbdMins: number): number {
  if (commuteCbdMins <= 25) return 4;
  if (commuteCbdMins <= 45) return 3;
  return 2;
}

type DimensionScores = {
  waterScore: number;
  securityScore: number;
  electricityScore: number;
  internetScore: number;
  cleanlinessScore: number;
  accessibilityScore: number;
};

function dimensionScoresFromProfile(
  profile: AreaProfile & { areaKey: string },
  amenities: string[],
  property: PropertyAnalysisInput,
): DimensionScores {
  let waterScore = LABEL_SCORE[profile.water];
  let securityScore = LABEL_SCORE[profile.security];
  let electricityScore = LABEL_SCORE[profile.electricity];
  let internetScore = Math.min(4, 1 + profile.internetProviders.length);
  let cleanlinessScore = 2.5;
  let accessibilityScore = accessibilityScoreFromCommute(profile.commuteCbdMins);

  waterScore = capScore(waterScore, amenityBoost(amenities, /borehole|water|tank/i, 0.5));
  securityScore = capScore(
    securityScore,
    amenityBoost(amenities, /gated|guard|cctv|security/i, 0.5),
  );
  electricityScore = capScore(
    electricityScore,
    amenityBoost(amenities, /backup|generator|solar|inverter/i, 0.5),
  );
  internetScore = capScore(internetScore, amenityBoost(amenities, /fibre|wifi|internet/i, 0.5));
  cleanlinessScore = capScore(
    cleanlinessScore,
    amenityBoost(amenities, /cleaning|housekeep|furnished/i, 0.5),
  );
  if (property.latitude != null && property.longitude != null) {
    accessibilityScore = Math.min(4, accessibilityScore + 0.5);
  }

  return {
    waterScore,
    securityScore,
    electricityScore,
    internetScore,
    cleanlinessScore,
    accessibilityScore,
  };
}

function mediaCompletenessHealthBoost(property: PropertyAnalysisInput, images: string[]): number {
  let boost = 0;
  if (images.length >= 5) boost += 5;
  else if (images.length >= 3) boost += 3;
  else if (images.length === 0) boost -= 8;
  if (property.video_url) boost += 2;
  if (property.tour_url) boost += 2;
  if ((property.description?.trim().length ?? 0) >= 80) boost += 3;
  if (property.area_sqm && property.area_sqm > 0) boost += 2;
  if (property.address?.trim()) boost += 2;
  return boost;
}

function rentFairnessFromComps(
  property: PropertyAnalysisInput,
  comps?: { rent_kes: number; bedrooms: number }[],
): {
  areaComps: { rent_kes: number; bedrooms: number }[];
  areaMedianRent: number | null;
  rentVsAreaMedianPct: number | null;
  healthAdjust: number;
} {
  const areaComps = (comps ?? []).filter((c) => c.rent_kes > 0);
  const sameBeds = areaComps.filter((c) => c.bedrooms === property.bedrooms);
  const rentPool = (sameBeds.length >= 3 ? sameBeds : areaComps).map((c) => c.rent_kes);
  let areaMedianRent: number | null = null;
  let rentVsAreaMedianPct: number | null = null;
  let healthAdjust = 0;

  if (rentPool.length === 0) {
    return { areaComps, areaMedianRent, rentVsAreaMedianPct, healthAdjust };
  }

  const sorted = [...rentPool].sort((a, b) => a - b);
  areaMedianRent = sorted[Math.floor(sorted.length / 2)] ?? null;
  if (areaMedianRent && areaMedianRent > 0) {
    rentVsAreaMedianPct = Math.round(((property.rent_kes - areaMedianRent) / areaMedianRent) * 100);
    if (rentVsAreaMedianPct <= -10) healthAdjust = 4;
    else if (rentVsAreaMedianPct >= 25) healthAdjust = -4;
  }

  return { areaComps, areaMedianRent, rentVsAreaMedianPct, healthAdjust };
}

function authenticityScoreFromInputs(
  property: PropertyAnalysisInput,
  images: string[],
  amenities: string[],
): number {
  let authenticityScore = 55;
  if (property.is_verified) authenticityScore += 20;
  if (images.length >= 5) authenticityScore += 10;
  else if (images.length >= 3) authenticityScore += 8;
  if (property.latitude != null && property.longitude != null) authenticityScore += 8;
  if (property.address?.trim()) authenticityScore += 5;
  if ((property.description?.trim().length ?? 0) >= 40) authenticityScore += 5;
  if (property.video_url || property.tour_url) authenticityScore += 4;
  if (amenities.length >= 3) authenticityScore += 3;
  return Math.max(20, Math.min(100, authenticityScore));
}

/**
 * Compute area-aware health + authenticity scores for a listing.
 * Uses neighborhood profile, amenities, media, and optional area rent comps.
 */
export function analyzePropertyArea(
  property: PropertyAnalysisInput,
  comps?: { rent_kes: number; bedrooms: number }[],
): PropertyAreaAnalysis {
  const profile = getAreaProfile(property.neighborhood);
  const amenities = property.amenities ?? [];
  const images = property.images ?? [];
  const dims = dimensionScoresFromProfile(profile, amenities, property);

  const dimensionAvg =
    (dims.waterScore +
      dims.securityScore +
      dims.electricityScore +
      dims.internetScore +
      dims.cleanlinessScore +
      dims.accessibilityScore) /
    6;
  const rent = rentFairnessFromComps(property, comps);
  let healthScore =
    Math.round(dimensionAvg * 20) +
    mediaCompletenessHealthBoost(property, images) +
    rent.healthAdjust;
  healthScore = Math.max(15, Math.min(98, healthScore));

  return {
    areaKey: profile.areaKey,
    water: labelFromScore(dims.waterScore),
    security: labelFromScore(dims.securityScore),
    electricity: labelFromScore(dims.electricityScore),
    internetProviders: profile.internetProviders,
    matatuRoute: profile.matatuRoute,
    commuteCbdMins: profile.commuteCbdMins,
    noise: profile.noise,
    subArea: profile.subAreas[0] ?? profile.areaKey,
    healthScore,
    authenticityScore: authenticityScoreFromInputs(property, images, amenities),
    rentVsAreaMedianPct: rent.rentVsAreaMedianPct,
    areaMedianRent: rent.areaMedianRent,
    areaListingCount: rent.areaComps.length,
  };
}
