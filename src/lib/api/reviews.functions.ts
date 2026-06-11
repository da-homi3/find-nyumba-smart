import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const propertyReviewSchema = z.object({
  propertyId: z.string().uuid(),
  ratingOverall: z.number().min(1).max(5),
  waterReliability: z.number().int().min(1).max(5),
  securityRating: z.number().int().min(1).max(5),
  internetReliability: z.number().int().min(1).max(5),
  electricityReliability: z.number().int().min(1).max(5),
  cleanliness: z.number().int().min(1).max(5),
  accessibility: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

const neighborhoodReviewSchema = z.object({
  neighborhood: z.string().trim().min(2),
  noiseLevel: z.number().int().min(1).max(5),
  safety: z.number().int().min(1).max(5),
  traffic: z.number().int().min(1).max(5),
  waterAvailability: z.number().int().min(1).max(5),
  security: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

function getContext(context: unknown) {
  const c = context as { supabase: SupabaseClient<Database>; userId: string };
  if (!c?.supabase || !c?.userId) throw new Error("Unauthorized");
  return c;
}

export const createPropertyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(propertyReviewSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getContext(context);

    // Occupancy gate: user must have completed viewing or active tenancy
    const [{ data: completedViewing }, { data: tenancy }] = await Promise.all([
      supabase
        .from("viewings")
        .select("id")
        .eq("property_id", data.propertyId)
        .eq("tenant_id", userId)
        .eq("status", "completed")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("tenancies")
        .select("id")
        .eq("property_id", data.propertyId)
        .eq("tenant_id", userId)
        .in("status", ["active", "completed"])
        .limit(1)
        .maybeSingle(),
    ]);

    if (!completedViewing && !tenancy) {
      throw new Error(
        "You can only review a property after completing a viewing or tenancy. Book a viewing first.",
      );
    }

    const { data: row, error } = await supabase
      .from("property_reviews")
      .insert({
        property_id: data.propertyId,
        reviewer_id: userId,
        rating_overall: data.ratingOverall,
        water_reliability: data.waterReliability,
        security_rating: data.securityRating,
        internet_reliability: data.internetReliability,
        electricity_reliability: data.electricityReliability,
        cleanliness: data.cleanliness,
        accessibility: data.accessibility,
        comment: data.comment ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return row;
  });

export const createNeighborhoodReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(neighborhoodReviewSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getContext(context);

    const { data: row, error } = await supabase
      .from("neighborhood_reviews")
      .insert({
        neighborhood: data.neighborhood,
        reviewer_id: userId,
        noise_level: data.noiseLevel,
        safety: data.safety,
        traffic: data.traffic,
        water_availability: data.waterAvailability,
        security: data.security,
        comment: data.comment ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return row;
  });

export const listPropertyReviews = createServerFn({ method: "POST" })
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin;

    const { data: rows, error } = await admin
      .from("property_reviews")
      .select(`
        *,
        profiles:reviewer_id (
          full_name,
          avatar_url
        )
      `)
      .eq("property_id", data.propertyId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return rows;
  });

export const listNeighborhoodReviews = createServerFn({ method: "POST" })
  .inputValidator(z.object({ neighborhood: z.string() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin;

    const { data: rows, error } = await admin
      .from("neighborhood_reviews")
      .select(`
        *,
        profiles:reviewer_id (
          full_name,
          avatar_url
        )
      `)
      .eq("neighborhood", data.neighborhood)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return rows;
  });
