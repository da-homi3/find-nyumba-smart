import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type PublicDb = SupabaseClient<Database>;

let publicClient: PublicDb | null = null;

/** Anon Supabase client for public reads — respects RLS, no service role. Reused per isolate. */
export function createPublicClient(): PublicDb {
  if (publicClient) return publicClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
  }
  publicClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return publicClient;
}

/** List/map projection — card fields only (no amenities/description/deposit payloads). */
const PUBLIC_PROPERTY_COLUMNS_BASE =
  "id,title,property_type,neighborhood,latitude,longitude,rent_kes,rent_kes_max,price_currency,rent_usd,rent_usd_max,bedrooms,bathrooms,images,is_verified,is_active,is_vacant,authenticity_score,available_from,pricing_mode,price_period,views,created_at,updated_at,featured_until,boost_package,nyumba_verified_at,location_id,county_location_id,constituency_location_id,ward_location_id" as const;

/** Safe columns for list/search/map views — no owner_id. */
export const PUBLIC_PROPERTY_COLUMNS = PUBLIC_PROPERTY_COLUMNS_BASE;

export const PUBLIC_PROPERTY_COLUMNS_LEGACY =
  "id,title,property_type,neighborhood,latitude,longitude,rent_kes,bedrooms,bathrooms,images,is_verified,is_active,is_vacant,authenticity_score,available_from,views,created_at,updated_at" as const;

/** Detail view includes owner_id + full media for booking/inquiry. */
export const PROPERTY_DETAIL_COLUMNS =
  "id,title,property_type,neighborhood,address,latitude,longitude,rent_kes,rent_kes_max,deposit_kes,price_currency,rent_usd,rent_usd_max,deposit_usd,bedrooms,bathrooms,area_sqm,area_sqm_max,amenities,images,is_verified,is_active,is_vacant,authenticity_score,health_score,available_from,pricing_mode,price_period,minimum_rent_period_months,views,created_at,updated_at,whatsapp_inquiries,description,video_url,tour_url,owner_id,featured_until,boost_package,nyumba_verified_at" as const;

export const PROPERTY_DETAIL_COLUMNS_LEGACY =
  "id,title,property_type,neighborhood,address,latitude,longitude,rent_kes,deposit_kes,bedrooms,bathrooms,area_sqm,amenities,images,is_verified,is_active,is_vacant,authenticity_score,health_score,available_from,views,created_at,updated_at,whatsapp_inquiries,description,video_url,tour_url,owner_id" as const;

export function isMissingRevenueColumnError(message: string | undefined): boolean {
  if (!message) return false;
  // Column-level privilege gaps (PII lockdown) often surface as table permission
  // denied without naming the column — fall back to the legacy projection.
  if (message.includes("permission denied") && message.includes("properties")) {
    return true;
  }
  return (
    message.includes("featured_until") ||
    message.includes("boost_package") ||
    message.includes("nyumba_verified_at") ||
    message.includes("minimum_rent_period_months") ||
    message.includes("pricing_mode") ||
    message.includes("price_period") ||
    message.includes("rent_kes_max") ||
    message.includes("price_currency") ||
    message.includes("rent_usd") ||
    message.includes("area_sqm_max") ||
    message.includes("landlord_plan") ||
    message.includes("tenant_plan") ||
    message.includes("plus_expires_at") ||
    message.includes("location_id") ||
    message.includes("county_location_id") ||
    message.includes("constituency_location_id") ||
    message.includes("ward_location_id")
  );
}
