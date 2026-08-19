import type { RecommendationWeights } from "@/lib/recommendations/types";

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  budget: 24,
  location: 22,
  bedrooms: 14,
  propertyType: 10,
  amenities: 8,
  moveIn: 6,
  behavior: 8,
  quality: 5,
  freshness: 3,
  explorationPercent: 20,
  maxPerShelf: 6,
  maxPerNeighborhood: 3,
  maxPerOwner: 2,
  freshnessDays: 14,
  minAuthenticity: 20,
  maxCandidates: 120,
};

export const HOW_RECOMMENDATIONS_WORK =
  "We recommend properties based on your preferences, searches, saved homes and activity on NyumbaSearch. We never use identity documents, income proofs, or other private verification files to rank homes.";
