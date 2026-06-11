import { getProperty, listProperties } from "@/lib/api/nyumba.functions";

export type PropertyType =
  | "bedsitter"
  | "single_room"
  | "one_bedroom"
  | "two_bedroom"
  | "three_bedroom"
  | "studio"
  | "hostel"
  | "maisonette"
  | "bungalow"
  | "townhouse";

export interface Property {
  id: string;
  owner_id: string | null;
  title: string;
  property_type: PropertyType;
  neighborhood: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rent_kes: number;
  deposit_kes: number | null;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  description: string | null;
  amenities: string[];
  images: string[];
  video_url: string | null;
  tour_url?: string | null;
  is_verified: boolean;
  is_active: boolean;
  authenticity_score?: number;
  health_score?: number;
  available_from: string | null;
  views: number;
  created_at: string;
  updated_at: string;
}

export const formatKes = (n: number) => "KES " + n.toLocaleString("en-KE");

export const prettyType = (t: PropertyType) =>
  ({
    bedsitter: "Bedsitter",
    single_room: "Single Room",
    one_bedroom: "1 Bedroom",
    two_bedroom: "2 Bedroom",
    three_bedroom: "3 Bedroom",
    studio: "Studio",
    hostel: "Hostel",
    maisonette: "Maisonette",
    bungalow: "Bungalow",
    townhouse: "Townhouse",
  })[t];

export async function fetchProperties(): Promise<Property[]> {
  const result = await listProperties({ data: {} });
  return result.items;
}

export type PropertySearchFilters = {
  query?: string;
  neighborhood?: string;
  propertyType?: PropertyType;
  minRent?: number;
  maxRent?: number;
  verifiedOnly?: boolean;
  minBedrooms?: number;
  minAuthenticityScore?: number;
  bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  limit?: number;
  offset?: number;
  sortBy?: "newest" | "price_asc" | "price_desc" | "score";
};

export async function searchProperties(filters?: PropertySearchFilters) {
  return listProperties({ data: filters ?? {} });
}

export async function fetchProperty(id: string): Promise<Property | null> {
  return getProperty({
    data: {
      id,
      sessionId: getAnonymousSessionId(),
      source: "property-detail",
    },
  });
}

function getAnonymousSessionId() {
  if (typeof window === "undefined") return undefined;

  const key = "nyumba_session_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const next = crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}
