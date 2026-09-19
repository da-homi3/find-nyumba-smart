import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimitDistributed, rateLimitKeyFromHeaders } from "@/lib/api/rate-limit";
import type { Database } from "@/integrations/supabase/types";

const submitSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(10).max(800),
});

export type PlatformReviewPublic = {
  id: string;
  displayName: string;
  rating: number;
  comment: string;
  createdAt: string;
  isPublished: boolean;
};

async function resolveOptionalUserId(): Promise<string | null> {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase.auth.getClaims(token);
  return data?.claims?.sub ?? null;
}

export const listPlatformReviews = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("platform_reviews")
    .select("id, display_name, rating, comment, created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("listPlatformReviews:", error.message);
    return [] as PlatformReviewPublic[];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    isPublished: true,
  })) satisfies PlatformReviewPublic[];
});

export const submitPlatformReview = createServerFn({ method: "POST" })
  .inputValidator(submitSchema)
  .handler(async ({ data }) => {
    const userId = await resolveOptionalUserId();
    const request = getRequest();
    const requester = userId ?? rateLimitKeyFromHeaders(request?.headers);
    const rate = await rateLimitDistributed(`platform-review:${requester}`, {
      max: userId ? 3 : 1,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (rate.limited) {
      throw new Error("A review was already submitted recently. Please try again later.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (userId) {
      const { data: existing } = await supabaseAdmin
        .from("platform_reviews")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        throw new Error("You already shared a review. Thank you!");
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from("platform_reviews")
      .insert({
        user_id: userId,
        display_name: data.displayName,
        rating: data.rating,
        comment: data.comment,
        // Authenticated users can publish directly; anonymous reviews require moderation.
        is_published: Boolean(userId),
      })
      .select("id, display_name, rating, comment, created_at, is_published")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("You already shared a review. Thank you!");
      }
      console.error("submitPlatformReview:", error.message);
      throw new Error("Could not save your review. Please try again.");
    }

    return {
      id: row.id,
      displayName: row.display_name,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at,
      isPublished: row.is_published,
    } satisfies PlatformReviewPublic;
  });
