export const REASON_CODES = [
  "budget_match",
  "budget_flexible",
  "location_match",
  "near_preferred_location",
  "bedroom_match",
  "property_type_match",
  "amenity_match",
  "parking_match",
  "move_in_match",
  "saved_similar",
  "viewed_similar",
  "search_match",
  "provider_followed",
  "price_drop",
  "new_listing",
  "popular_in_preferred_area",
  "verified_quality",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export type RecommendationType =
  | "personalized"
  | "search_match"
  | "similar"
  | "because_saved"
  | "because_viewed"
  | "new_listing"
  | "price_drop"
  | "near_location"
  | "available_soon"
  | "discovery"
  | "provider";

export type RecShelfId =
  | "recommended_for_you"
  | "based_on_your_search"
  | "because_you_saved"
  | "because_you_viewed"
  | "similar_to_shortlist"
  | "new_in_your_areas"
  | "price_drops"
  | "just_listed"
  | "available_soon"
  | "near_preferred_locations"
  | "you_may_have_missed"
  | "from_providers_you_follow"
  | "providers_you_may_like"
  | "more_like_this"
  | "more_from_this_provider";

export type TenantNeeds = {
  budgetMin: number | null;
  budgetMax: number | null;
  budgetStrict: boolean;
  locations: string[];
  bedrooms: number | null;
  propertyType: string | null;
  parkingRequired: boolean;
  moveInDate: string | null;
  amenities: string[];
};

export type RecProperty = {
  id: string;
  title: string;
  neighborhood: string;
  rentKes: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  amenities: string[];
  isVerified: boolean;
  isVacant: boolean;
  authenticityScore: number;
  availableFrom: string | null;
  createdAt: string;
  updatedAt: string;
  ownerId: string | null;
  organizationId: string | null;
  images: string[];
  views: number;
};

export type PriceDropSignal = {
  propertyId: string;
  previousRent: number;
  newRent: number;
};

export type BehaviorSignals = {
  viewed: RecProperty[];
  saved: RecProperty[];
  searchedLocations: string[];
  contactedOwnerIds: string[];
  hiddenPropertyIds: string[];
  hiddenOwnerIds: string[];
  priceDrops: PriceDropSignal[];
  personalizationEnabled: boolean;
  /** Ignore behavioral signals from before this instant (reset). */
  resetAt: string | null;
};

export type RecommendationWeights = {
  budget: number;
  location: number;
  bedrooms: number;
  propertyType: number;
  amenities: number;
  moveIn: number;
  behavior: number;
  quality: number;
  freshness: number;
  explorationPercent: number;
  maxPerShelf: number;
  maxPerNeighborhood: number;
  maxPerOwner: number;
  freshnessDays: number;
  minAuthenticity: number;
  maxCandidates: number;
};

export type ScoredRecommendation = {
  propertyId: string;
  matchScore: number;
  reasonCodes: ReasonCode[];
  reasons: string[];
  recommendationType: RecommendationType;
  discovery: boolean;
  rank: number;
  previousRentKes?: number;
  newRentKes?: number;
};

export type ProviderRecommendation = {
  ownerId: string;
  name: string;
  verified: boolean;
  matchScore: number;
  activeCount: number;
  matchCount: number;
  areas: string[];
  reasons: string[];
  specialties: string[];
};

export type RecShelf = {
  id: RecShelfId;
  title: string;
  subtitle: string | null;
  plusOnly: boolean;
  items: ScoredRecommendation[];
};

export type RecommendationFeed = {
  greeting: string;
  firstName: string;
  coldStart: boolean;
  plus: boolean;
  personalizationEnabled: boolean;
  howItWorks: string;
  shelves: RecShelf[];
  providers: ProviderRecommendation[];
  portfolioMatchCount: number | null;
  newMatchCount: number;
  exploreLocation: string | null;
  ownerScope: string | null;
  expiresAt: string;
};

export const FEEDBACK_ACTIONS = [
  "not_interested",
  "not_my_location",
  "too_expensive",
  "too_small",
  "already_rented",
  "not_my_property_type",
  "hide",
  "dont_recommend_provider",
] as const;

export type FeedbackAction = (typeof FEEDBACK_ACTIONS)[number];

export const EMPTY_NEEDS: TenantNeeds = {
  budgetMin: null,
  budgetMax: null,
  budgetStrict: false,
  locations: [],
  bedrooms: null,
  propertyType: null,
  parkingRequired: false,
  moveInDate: null,
  amenities: [],
};

export const EMPTY_BEHAVIOR: BehaviorSignals = {
  viewed: [],
  saved: [],
  searchedLocations: [],
  contactedOwnerIds: [],
  hiddenPropertyIds: [],
  hiddenOwnerIds: [],
  priceDrops: [],
  personalizationEnabled: true,
  resetAt: null,
};
