import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { FEEDBACK_ACTIONS } from "@/lib/recommendations/types";

async function viewerName(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return data?.full_name?.trim() || "there";
}

export const getRecommendationFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ownerId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    const { getTenantPlusStatus } = await import("@/lib/revenue/subscription-store");
    const plus = await getTenantPlusStatus(supabase, userId);
    const { buildRecommendationFeed, hydrateRecommendationFeed } = await import(
      "@/lib/recommendations/service"
    );
    const feed = await buildRecommendationFeed({
      userId,
      plus: plus.tenantPlan === "plus",
      firstName: await viewerName(userId),
      ownerScope: data.ownerId ?? null,
    });
    return hydrateRecommendationFeed(feed);
  });

export const getMoreLikeThis = createServerFn({ method: "POST" })
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { buildMoreLikeThis } = await import("@/lib/recommendations/service");
    return buildMoreLikeThis({ propertyId: data.propertyId, userId: null, plus: false });
  });

export const recordRecommendationFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      action: z.enum(FEEDBACK_ACTIONS),
      propertyId: z.string().uuid().optional(),
      ownerId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { recordRecommendationFeedback: save } = await import("@/lib/recommendations/service");
    return save({
      userId,
      action: data.action,
      propertyId: data.propertyId,
      ownerId: data.ownerId,
    });
  });

export const recordRecommendationEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      eventName: z
        .enum([
          "recommendation_impression",
          "recommendation_click",
          "recommendation_save",
          "recommendation_compare",
          "recommendation_contact",
          "recommendation_viewing",
          "recommendation_application",
          "recommendation_hide",
          "recommendation_provider_follow",
          "recommendation_alert_open",
        ]),
      propertyId: z.string().uuid().optional(),
      shelfId: z.string().max(80).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { recordRecommendationEvent: save } = await import("@/lib/recommendations/service");
    await save({
      userId,
      eventName: data.eventName,
      propertyId: data.propertyId,
      shelfId: data.shelfId,
    });
    return { recorded: true };
  });

export const updateRecommendationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      recsEnabled: z.boolean().optional(),
      reset: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { updateRecommendationPrefs } = await import("@/lib/recommendations/service");
    return updateRecommendationPrefs({
      userId,
      recsEnabled: data.recsEnabled,
      reset: data.reset,
    });
  });
