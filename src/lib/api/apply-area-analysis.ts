import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { analyzePropertyArea } from "@/lib/area-analysis";

type Admin = SupabaseClient<Database>;

/**
 * Runs neighborhood/area analysis and persists health + authenticity scores
 * so tenant-facing stats reflect the listing's area and amenities.
 */
export async function applyPropertyAreaAnalysis(
  admin: Admin,
  propertyId: string,
): Promise<{ healthScore: number; authenticityScore: number }> {
  const { data: property, error } = await admin
    .from("properties")
    .select(
      "id, neighborhood, amenities, images, video_url, tour_url, description, latitude, longitude, area_sqm, rent_kes, bedrooms, bathrooms, is_verified, address",
    )
    .eq("id", propertyId)
    .maybeSingle();

  if (error) throw error;
  if (!property) throw new Error("Property not found");

  const { data: comps } = await admin
    .from("properties")
    .select("rent_kes, bedrooms")
    .eq("is_active", true)
    .eq("neighborhood", property.neighborhood)
    .neq("id", propertyId)
    .limit(40);

  const analysis = analyzePropertyArea(property, comps ?? []);

  const { error: updateError } = await admin
    .from("properties")
    .update({
      health_score: analysis.healthScore,
      authenticity_score: analysis.authenticityScore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", propertyId);

  if (updateError) throw updateError;

  return {
    healthScore: analysis.healthScore,
    authenticityScore: analysis.authenticityScore,
  };
}
