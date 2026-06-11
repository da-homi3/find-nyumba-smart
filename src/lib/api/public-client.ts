import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Anon Supabase client for public reads — respects RLS, no service role. */
export function createPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Safe columns for list/search/map views — no owner_id. */
export const PUBLIC_PROPERTY_COLUMNS =
  "id,title,property_type,neighborhood,address,latitude,longitude,rent_kes,deposit_kes,bedrooms,bathrooms,area_sqm,description,amenities,images,video_url,tour_url,is_verified,is_active,is_vacant,authenticity_score,health_score,available_from,views,created_at,updated_at" as const;

/** Detail view includes owner_id for booking/inquiry (single-property endpoint only). */
export const PROPERTY_DETAIL_COLUMNS = `${PUBLIC_PROPERTY_COLUMNS},owner_id` as const;
