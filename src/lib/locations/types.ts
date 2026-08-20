export type LocationType =
  | "COUNTRY"
  | "COUNTY"
  | "SUB_COUNTY"
  | "CONSTITUENCY"
  | "WARD"
  | "DIVISION"
  | "LOCATION"
  | "SUB_LOCATION"
  | "TOWN"
  | "CITY"
  | "MUNICIPALITY"
  | "LOCALITY"
  | "VILLAGE"
  | "ESTATE"
  | "NEIGHBOURHOOD"
  | "MARKET"
  | "TRADING_CENTRE"
  | "ROAD"
  | "STREET"
  | "LANDMARK"
  | "POSTAL_AREA"
  | "BUILDING"
  | "PROPERTY"
  | "UNVERIFIED";

export type LocationRow = {
  id: string;
  parent_id: string | null;
  name: string;
  normalized_name: string;
  slug: string;
  location_type: LocationType;
  official_code: string | null;
  country_code: string;
  county_code: string | null;
  constituency_code: string | null;
  ward_code: string | null;
  latitude: number | null;
  longitude: number | null;
  bbox: number[] | null;
  source: string;
  source_id: string | null;
  source_url: string | null;
  confidence_score: number;
  is_official: boolean;
  is_active: boolean;
  inventory_count: number;
};

export type LocationPublic = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  type: LocationType;
  lat: number | null;
  lng: number | null;
  isOfficial: boolean;
  confidence: number;
  inventoryCount: number;
  label: string;
  subtitle?: string;
};

export type LocationSearchHit = LocationPublic & {
  matchVia: "name" | "alias" | "prefix";
  score: number;
  distanceKm?: number;
};

export type ResolvedLocation = LocationPublic & {
  ancestors: LocationPublic[];
  matchConfidence: number;
  needsReview: boolean;
};

export type ReverseGeocodeResult = {
  county: LocationPublic | null;
  constituency: LocationPublic | null;
  ward: LocationPublic | null;
  locality: LocationPublic | null;
  confidence: number;
  method: "polygon" | "nearest_centroid" | "none";
};

export const SEARCHABLE_TYPES: LocationType[] = [
  "COUNTY",
  "CONSTITUENCY",
  "WARD",
  "LOCALITY",
  "NEIGHBOURHOOD",
  "ESTATE",
  "TOWN",
  "CITY",
];

export const SEO_AREA_TYPES: LocationType[] = [
  "LOCALITY",
  "NEIGHBOURHOOD",
  "ESTATE",
  "WARD",
];

/** Localities/neighbourhoods need denser inventory before indexing. */
export const SEO_INVENTORY_THRESHOLD = 3;
/** National ward SEO: index wards with any live listing (Phase 3 expansion). */
export const SEO_WARD_INVENTORY_THRESHOLD = 1;
