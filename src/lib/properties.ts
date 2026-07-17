import { getProperty, listProperties } from "@/lib/api/nyumba.functions";
import { getAnonymousSessionId } from "@/lib/anonymous-session";
import { fetchListingsApi } from "@/lib/listings-client";
import type { PropertyType, PricingMode, PricePeriod } from "@/lib/property-types";

export type { PropertyType } from "@/lib/property-types";
export { prettyPropertyType as prettyType } from "@/lib/property-types";

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
  rent_kes_max?: number | null;
  deposit_kes: number | null;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  area_sqm_max?: number | null;
  description: string | null;
  amenities: string[];
  images: string[];
  video_url: string | null;
  tour_url?: string | null;
  is_verified: boolean;
  is_active: boolean;
  is_vacant?: boolean;
  organization_id?: string | null;
  authenticity_score?: number;
  health_score?: number;
  available_from: string | null;
  minimum_rent_period_months?: number | null;
  pricing_mode?: PricingMode | null;
  price_period?: PricePeriod | null;
  /** Listing-level contact; omitted from public selects, present when managing a listing. */
  contact_phone?: string | null;
  /** All unlockable listing phones (primary first). */
  contact_phones?: string[];
  contact_name?: string | null;
  /** Admin listings: Message CTA opens WhatsApp instead of in-app inquiry. */
  whatsapp_inquiries?: boolean;
  views: number;
  created_at: string;
  updated_at: string;
  featured_until?: string | null;
  boost_package?: string | null;
  nyumba_verified_at?: string | null;
  /** Set client-side when map pin uses neighborhood centroid */
  map_approximate?: boolean;
}

export const formatKes = (n: number) => "KES " + n.toLocaleString("en-KE");

function isBrowser(): boolean {
  return globalThis.window !== undefined;
}

export async function fetchProperties(filters?: PropertySearchFilters): Promise<Property[]> {
  if (isBrowser()) {
    const result = await fetchListingsApi({
      limit: filters?.limit ?? 50,
      offset: filters?.offset ?? 0,
      ...filters,
    });
    return result.items;
  }
  const result = await listProperties({
    data: { limit: filters?.limit ?? 50, offset: filters?.offset ?? 0, ...filters },
  });
  return result.items;
}

/** Map view — up to 500 active listings with optional bounds filter. */
export async function fetchMapProperties(filters?: PropertySearchFilters) {
  return searchProperties({
    ...filters,
    limit: filters?.limit ?? 500,
    offset: filters?.offset ?? 0,
  });
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
  if (isBrowser()) {
    return fetchListingsApi(filters ?? {});
  }
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

