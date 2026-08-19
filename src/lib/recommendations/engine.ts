import { locationRelation, normalizeLocation } from "@/lib/recommendations/locations";
import { explainReason } from "@/lib/recommendations/reasons";
import type {
  BehaviorSignals,
  RecProperty,
  RecShelf,
  RecShelfId,
  ReasonCode,
  RecommendationType,
  RecommendationWeights,
  ScoredRecommendation,
  TenantNeeds,
} from "@/lib/recommendations/types";
import { EMPTY_BEHAVIOR } from "@/lib/recommendations/types";

const FLEX_BUDGET_RATIO = 0.1;
const HARD_BUDGET_RATIO = 0.4;

function hasParking(amenities: string[]): boolean {
  return amenities.some((a) => /park/i.test(a));
}

function daysAgo(iso: string, now: number): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 999;
  return (now - t) / (24 * 60 * 60 * 1000);
}

function similarToSet(property: RecProperty, set: RecProperty[]): boolean {
  if (set.length < 2) return false;
  let hits = 0;
  for (const other of set) {
    const sameHood =
      other.neighborhood.trim().toLowerCase() === property.neighborhood.trim().toLowerCase();
    const sameBeds = other.bedrooms === property.bedrooms;
    const priceClose =
      other.rentKes > 0 &&
      Math.abs(other.rentKes - property.rentKes) / Math.max(other.rentKes, 1) <= 0.2;
    if ((sameHood && sameBeds) || (sameBeds && priceClose) || (sameHood && priceClose)) {
      hits += 1;
    }
  }
  return hits >= 2;
}

export function isColdStart(needs: TenantNeeds, behavior: BehaviorSignals): boolean {
  const hasPrefs =
    needs.locations.length > 0 ||
    needs.budgetMax != null ||
    needs.budgetMin != null ||
    needs.bedrooms != null ||
    Boolean(needs.propertyType);
  if (hasPrefs) return false;
  if (!behavior.personalizationEnabled) return true;
  return behavior.saved.length === 0 && behavior.viewed.length < 3 && behavior.searchedLocations.length === 0;
}

type ScoreChunk = { pts: number; reasons: ReasonCode[] };
type LocKind = "exact" | "nearby" | "none";

function scoreBudget(property: RecProperty, needs: TenantNeeds, weights: RecommendationWeights): ScoreChunk | null {
  const cap = needs.budgetMax ?? needs.budgetMin;
  if (cap == null || cap <= 0) {
    return { pts: Math.round(weights.budget * 0.4), reasons: [] };
  }
  if (property.rentKes <= cap) {
    return { pts: weights.budget, reasons: ["budget_match"] };
  }
  if (!needs.budgetStrict && property.rentKes <= cap * (1 + FLEX_BUDGET_RATIO)) {
    return { pts: Math.round(weights.budget * 0.55), reasons: ["budget_flexible"] };
  }
  if (property.rentKes > cap * (1 + HARD_BUDGET_RATIO)) return null;
  return { pts: 0, reasons: [] };
}

function scoreLocation(property: RecProperty, needs: TenantNeeds, weights: RecommendationWeights): ScoreChunk & { loc: LocKind } {
  const loc = locationRelation(property.neighborhood, needs.locations);
  if (loc === "exact") {
    return { pts: weights.location, reasons: ["location_match"], loc };
  }
  if (loc === "nearby") {
    return { pts: Math.round(weights.location * 0.65), reasons: ["near_preferred_location"], loc };
  }
  if (needs.locations.length === 0) {
    return { pts: Math.round(weights.location * 0.35), reasons: [], loc };
  }
  return { pts: 0, reasons: [], loc };
}

function scoreBedrooms(property: RecProperty, needs: TenantNeeds, weights: RecommendationWeights): ScoreChunk {
  if (needs.bedrooms == null) {
    return { pts: Math.round(weights.bedrooms * 0.4), reasons: [] };
  }
  if (property.bedrooms === needs.bedrooms) {
    return { pts: weights.bedrooms, reasons: ["bedroom_match"] };
  }
  if (Math.abs(property.bedrooms - needs.bedrooms) === 1) {
    return { pts: Math.round(weights.bedrooms * 0.45), reasons: [] };
  }
  return { pts: 0, reasons: [] };
}

function scorePropertyType(property: RecProperty, needs: TenantNeeds, weights: RecommendationWeights): ScoreChunk {
  if (!needs.propertyType) {
    return { pts: Math.round(weights.propertyType * 0.4), reasons: [] };
  }
  if (property.propertyType === needs.propertyType) {
    return { pts: weights.propertyType, reasons: ["property_type_match"] };
  }
  return { pts: 0, reasons: [] };
}

function scoreAmenities(property: RecProperty, needs: TenantNeeds, weights: RecommendationWeights): ScoreChunk {
  if (needs.parkingRequired) {
    if (hasParking(property.amenities)) {
      return { pts: weights.amenities, reasons: ["parking_match"] };
    }
    return { pts: 0, reasons: [] };
  }
  if (needs.amenities.length > 0) {
    const hits = needs.amenities.filter((need) =>
      property.amenities.some((a) => a.toLowerCase().includes(need.toLowerCase())),
    ).length;
    if (hits > 0) {
      return {
        pts: Math.round(weights.amenities * Math.min(1, hits / needs.amenities.length)),
        reasons: ["amenity_match"],
      };
    }
    return { pts: 0, reasons: [] };
  }
  return { pts: Math.round(weights.amenities * 0.3), reasons: [] };
}

function scoreMoveIn(property: RecProperty, needs: TenantNeeds, weights: RecommendationWeights, now: number): ScoreChunk {
  if (needs.moveInDate && property.availableFrom) {
    const want = new Date(needs.moveInDate).getTime();
    const avail = new Date(property.availableFrom).getTime();
    if (Number.isFinite(want) && Number.isFinite(avail) && avail <= want + 14 * 24 * 60 * 60 * 1000) {
      return { pts: weights.moveIn, reasons: ["move_in_match"] };
    }
    return { pts: 0, reasons: [] };
  }
  if (property.isVacant) {
    const reasons: ReasonCode[] = daysAgo(property.createdAt, now) <= 21 ? ["move_in_match"] : [];
    return { pts: Math.round(weights.moveIn * 0.5), reasons };
  }
  return { pts: 0, reasons: [] };
}

function scoreBehavior(property: RecProperty, behavior: BehaviorSignals, weights: RecommendationWeights): ScoreChunk {
  let pts = 0;
  const reasons: ReasonCode[] = [];
  if (behavior.personalizationEnabled) {
    if (similarToSet(property, behavior.saved)) {
      pts += Math.round(weights.behavior * 0.6);
      reasons.push("saved_similar");
    }
    if (similarToSet(property, behavior.viewed)) {
      pts += Math.round(weights.behavior * 0.4);
      reasons.push("viewed_similar");
    }
  }
  if (behavior.searchedLocations.some((s) => locationRelation(property.neighborhood, [s]) === "exact")) {
    reasons.push("search_match");
    pts = Math.max(pts, Math.round(weights.behavior * 0.5));
  }
  if (property.ownerId && behavior.contactedOwnerIds.includes(property.ownerId)) {
    reasons.push("provider_followed");
    pts = Math.max(pts, Math.round(weights.behavior * 0.35));
  }
  return { pts, reasons };
}

function scoreQuality(property: RecProperty, loc: LocKind, weights: RecommendationWeights): ScoreChunk {
  let pts = 0;
  const reasons: ReasonCode[] = [];
  if (property.isVerified) {
    pts += Math.round(weights.quality * 0.6);
    reasons.push("verified_quality");
  }
  if (property.authenticityScore >= 70) pts += Math.round(weights.quality * 0.4);
  else if (property.images.length >= 3) pts += Math.round(weights.quality * 0.2);
  if (loc === "exact" && property.views >= 20) reasons.push("popular_in_preferred_area");
  return { pts, reasons };
}

function scoreFreshness(property: RecProperty, weights: RecommendationWeights, now: number): ScoreChunk {
  const ageDays = daysAgo(property.createdAt, now);
  if (ageDays <= 3) return { pts: weights.freshness, reasons: ["new_listing"] };
  if (ageDays <= weights.freshnessDays) return { pts: Math.round(weights.freshness * 0.5), reasons: [] };
  return { pts: 0, reasons: [] };
}

export function scoreProperty(
  property: RecProperty,
  needs: TenantNeeds,
  behavior: BehaviorSignals,
  weights: RecommendationWeights,
  now = Date.now(),
): ScoredRecommendation | null {
  if (!property.isVacant) return null;
  if (property.authenticityScore > 0 && property.authenticityScore < weights.minAuthenticity) {
    return null;
  }
  if (behavior.hiddenPropertyIds.includes(property.id)) return null;
  if (property.ownerId && behavior.hiddenOwnerIds.includes(property.ownerId)) return null;

  const budget = scoreBudget(property, needs, weights);
  if (!budget) return null;
  const location = scoreLocation(property, needs, weights);
  const bedrooms = scoreBedrooms(property, needs, weights);
  const type = scorePropertyType(property, needs, weights);
  const amenities = scoreAmenities(property, needs, weights);
  const moveIn = scoreMoveIn(property, needs, weights, now);
  const behaviorScore = scoreBehavior(property, behavior, weights);
  const quality = scoreQuality(property, location.loc, weights);
  const freshness = scoreFreshness(property, weights, now);

  const chunks = [budget, location, bedrooms, type, amenities, moveIn, behaviorScore, quality, freshness];
  const reasons = chunks.flatMap((chunk) => chunk.reasons);
  const totalWeight =
    weights.budget +
    weights.location +
    weights.bedrooms +
    weights.propertyType +
    weights.amenities +
    weights.moveIn +
    weights.behavior +
    weights.quality +
    weights.freshness;
  const raw = chunks.reduce((sum, chunk) => sum + chunk.pts, 0);
  const matchScore = Math.max(1, Math.min(99, Math.round((raw / Math.max(totalWeight, 1)) * 100)));

  const uniqueReasons = [...new Set(reasons)];
  if (uniqueReasons.length === 0) return null;

  return {
    propertyId: property.id,
    matchScore,
    reasonCodes: uniqueReasons,
    reasons: uniqueReasons.map((code) =>
      explainReason(code, needs, {
        rentKes: property.rentKes,
        neighborhood: property.neighborhood,
        bedrooms: property.bedrooms,
      }),
    ),
    recommendationType: "personalized",
    discovery: location.loc === "nearby" || uniqueReasons.includes("budget_flexible"),
    rank: 0,
  };
}

export function diversify(
  scored: ScoredRecommendation[],
  byId: Map<string, RecProperty>,
  weights: RecommendationWeights,
): ScoredRecommendation[] {
  const hoodCount = new Map<string, number>();
  const ownerCount = new Map<string, number>();
  const out: ScoredRecommendation[] = [];
  const sorted = [...scored].sort((a, b) => b.matchScore - a.matchScore);
  for (const item of sorted) {
    const property = byId.get(item.propertyId);
    if (!property) continue;
    const hood = property.neighborhood.trim().toLowerCase() || "unknown";
    const owner = property.ownerId ?? `solo:${property.id}`;
    if ((hoodCount.get(hood) ?? 0) >= weights.maxPerNeighborhood) continue;
    if ((ownerCount.get(owner) ?? 0) >= weights.maxPerOwner) continue;
    hoodCount.set(hood, (hoodCount.get(hood) ?? 0) + 1);
    ownerCount.set(owner, (ownerCount.get(owner) ?? 0) + 1);
    out.push(item);
  }
  return out.map((item, index) => ({ ...item, rank: index + 1 }));
}

function applyExploration(
  ranked: ScoredRecommendation[],
  weights: RecommendationWeights,
): ScoredRecommendation[] {
  if (ranked.length < 5) return ranked;
  const exploreN = Math.max(1, Math.round(ranked.length * (weights.explorationPercent / 100)));
  const core = ranked.slice(0, ranked.length - exploreN);
  const tail = ranked.slice(ranked.length - exploreN).map((item) => ({
    ...item,
    discovery: true,
    recommendationType: "discovery" as const,
  }));
  return [...core, ...tail].map((item, index) => ({ ...item, rank: index + 1 }));
}

function takeShelf(
  items: ScoredRecommendation[],
  type: RecommendationType,
  limit: number,
): ScoredRecommendation[] {
  return items
    .filter((item) => item.reasonCodes.length > 0)
    .slice(0, limit)
    .map((item, index) => ({ ...item, recommendationType: type, rank: index + 1 }));
}

export function buildShelves(input: {
  scored: ScoredRecommendation[];
  byId: Map<string, RecProperty>;
  needs: TenantNeeds;
  behavior: BehaviorSignals;
  plus: boolean;
  weights: RecommendationWeights;
  ownerScope?: string | null;
}): RecShelf[] {
  const ranked = applyExploration(input.scored, input.weights);
  const limit = input.weights.maxPerShelf;
  const savedIds = new Set(input.behavior.saved.map((p) => p.id));
  const viewedIds = new Set(input.behavior.viewed.map((p) => p.id));
  const scoped = Boolean(input.ownerScope);

  const becauseSaved = ranked.filter((item) => item.reasonCodes.includes("saved_similar") && !savedIds.has(item.propertyId));
  const becauseViewed = ranked.filter((item) => item.reasonCodes.includes("viewed_similar") && !viewedIds.has(item.propertyId));
  const searchMatch = ranked.filter((item) => item.reasonCodes.includes("search_match"));
  const nearby = ranked.filter((item) => item.reasonCodes.includes("near_preferred_location"));
  const fresh = ranked.filter((item) => item.reasonCodes.includes("new_listing"));
  const soon = ranked.filter((item) => item.reasonCodes.includes("move_in_match"));
  const top = ranked.filter((item) => !item.discovery);
  const rest = ranked.filter((item) => item.propertyId !== top[0]?.propertyId);

  const shelves: RecShelf[] = [];

  const push = (
    id: RecShelfId,
    title: string,
    subtitle: string | null,
    plusOnly: boolean,
    items: ScoredRecommendation[],
    type: RecommendationType,
  ) => {
    if (plusOnly && !input.plus) return;
    if (items.length === 0) return;
    shelves.push({ id, title, subtitle, plusOnly, items: takeShelf(items, type, limit) });
  };

  push(
    "recommended_for_you",
    "Recommended for you",
    scoped ? "Top matches from this provider" : "Based on your preferences",
    false,
    top,
    input.plus ? "personalized" : "search_match",
  );
  if (scoped) {
    push("more_from_this_provider", "More from this provider", null, false, rest, "similar");
    push("similar_to_shortlist", "Similar homes", null, false, becauseSaved, "similar");
    return shelves.slice(0, 5);
  }
  push("based_on_your_search", "Based on your search", null, false, searchMatch, "search_match");
  push("because_you_saved", "Because you saved", "You may also like", true, becauseSaved, "because_saved");
  push("because_you_viewed", "Because you viewed", null, true, becauseViewed, "because_viewed");
  push("similar_to_shortlist", "Similar to your shortlist", null, false, becauseSaved, "similar");
  push("new_in_your_areas", "New in your areas", "Just listed", true, fresh, "new_listing");
  push("just_listed", "Just listed", null, false, fresh, "new_listing");
  push("available_soon", "Available soon", null, true, soon, "available_soon");
  push(
    "near_preferred_locations",
    "Near your preferred locations",
    "Nearby areas — not a change to your search",
    true,
    nearby,
    "near_location",
  );
  push(
    "from_providers_you_follow",
    "From providers you follow",
    "Homes from landlords and agencies you've contacted",
    true,
    ranked.filter((item) => item.reasonCodes.includes("provider_followed")),
    "provider",
  );
  const dropItems: ScoredRecommendation[] = [];
  for (const drop of input.behavior.priceDrops) {
    const property = input.byId.get(drop.propertyId);
    const base = ranked.find((item) => item.propertyId === drop.propertyId);
    if (!property || !base) continue;
    const reasons = [
      `Was ${drop.previousRent.toLocaleString("en-KE")} · now ${drop.newRent.toLocaleString("en-KE")}`,
      ...base.reasons.filter((r) => !/price dropped/i.test(r)).slice(0, 3),
    ];
    dropItems.push({
      ...base,
      reasonCodes: ["price_drop", ...base.reasonCodes.filter((c) => c !== "price_drop")],
      reasons,
      recommendationType: "price_drop",
      discovery: false,
      previousRentKes: drop.previousRent,
      newRentKes: drop.newRent,
    });
  }
  push("price_drops", "Price drops", "A saved or viewed home reduced its rent", true, dropItems, "price_drop");
  push(
    "you_may_have_missed",
    "Homes you may have missed",
    "Discovery picks",
    true,
    ranked.filter((item) => item.discovery),
    "discovery",
  );

  return shelves.slice(0, 8);
}

export function needsFromProperty(property: RecProperty): TenantNeeds {
  const rent = property.rentKes > 0 ? property.rentKes : null;
  return {
    budgetMin: rent ? Math.round(rent * 0.8) : null,
    budgetMax: rent ? Math.round(rent * 1.2) : null,
    budgetStrict: false,
    locations: property.neighborhood ? [normalizeLocation(property.neighborhood)] : [],
    bedrooms: property.bedrooms || null,
    propertyType: property.propertyType || null,
    parkingRequired: hasParking(property.amenities),
    moveInDate: null,
    amenities: property.amenities.slice(0, 5),
  };
}

/** Similarity ranking — provider is a small bonus only when other factors already match. */
export function moreLikeThis(
  source: RecProperty,
  candidates: RecProperty[],
  weights: RecommendationWeights,
  hiddenPropertyIds: string[] = [],
): ScoredRecommendation[] {
  const needs = needsFromProperty(source);
  const behavior: BehaviorSignals = {
    ...EMPTY_BEHAVIOR,
    hiddenPropertyIds,
    personalizationEnabled: false,
  };
  const byId = new Map(candidates.map((p) => [p.id, p]));
  const scored: ScoredRecommendation[] = [];
  for (const property of candidates) {
    if (property.id === source.id) continue;
    const item = scoreProperty(property, needs, behavior, weights);
    if (!item) continue;
    const core = item.reasonCodes.some((code) =>
      code === "location_match" ||
      code === "near_preferred_location" ||
      code === "bedroom_match" ||
      code === "property_type_match",
    );
    if (!core) continue;
    const sameOwner = Boolean(source.ownerId && property.ownerId === source.ownerId);
    scored.push({
      ...item,
      recommendationType: "similar",
      matchScore: sameOwner ? Math.min(99, item.matchScore + 2) : item.matchScore,
    });
  }
  return diversify(scored, byId, weights).slice(0, weights.maxPerShelf);
}

export function inferNeedsFromBehavior(behavior: BehaviorSignals): Partial<TenantNeeds> {
  const pool = [...behavior.saved, ...behavior.viewed];
  if (pool.length < 3) return {};
  const hoods = new Map<string, number>();
  const beds = new Map<number, number>();
  const rents: number[] = [];
  for (const item of pool) {
    const hood = item.neighborhood.trim().toLowerCase();
    if (hood) hoods.set(hood, (hoods.get(hood) ?? 0) + 1);
    beds.set(item.bedrooms, (beds.get(item.bedrooms) ?? 0) + 1);
    if (item.rentKes > 0) rents.push(item.rentKes);
  }
  const topHood = [...hoods.entries()].sort((a, b) => b[1] - a[1])[0];
  const topBeds = [...beds.entries()].sort((a, b) => b[1] - a[1])[0];
  const inferred: Partial<TenantNeeds> = {};
  if (topHood && topHood[1] >= 2) inferred.locations = [topHood[0]];
  if (topBeds && topBeds[1] >= 2) inferred.bedrooms = topBeds[0];
  if (rents.length >= 3) {
    const sorted = [...rents].sort((a, b) => a - b);
    inferred.budgetMin = sorted[0] ?? null;
    inferred.budgetMax = sorted[Math.floor(sorted.length * 0.8)] ?? null;
  }
  return inferred;
}

export function mergeNeeds(explicit: TenantNeeds, inferred: Partial<TenantNeeds>): TenantNeeds {
  return {
    budgetMin: explicit.budgetMin ?? inferred.budgetMin ?? null,
    budgetMax: explicit.budgetMax ?? inferred.budgetMax ?? null,
    budgetStrict: explicit.budgetStrict,
    locations: explicit.locations.length > 0 ? explicit.locations : (inferred.locations ?? []),
    bedrooms: explicit.bedrooms ?? inferred.bedrooms ?? null,
    propertyType: explicit.propertyType,
    parkingRequired: explicit.parkingRequired,
    moveInDate: explicit.moveInDate,
    amenities: explicit.amenities,
  };
}
