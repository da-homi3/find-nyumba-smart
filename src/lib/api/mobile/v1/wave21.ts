import { mobileError, mobileJson, requireMobileBearer } from "@/lib/api/mobile/v1/auth";
import { parseJsonBody, parseUuid } from "@/lib/api/mobile/v1/helpers";
import { FEEDBACK_ACTIONS, type FeedbackAction } from "@/lib/recommendations/types";

async function viewerName(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return data?.full_name?.trim() || "there";
}

async function handleFeed(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const url = new URL(req.url);
  const ownerId = parseUuid(url.searchParams.get("ownerId") ?? undefined);

  try {
    const { getTenantPlusStatus } = await import("@/lib/revenue/subscription-store");
    const plus = await getTenantPlusStatus(auth.admin, auth.userId);
    const { buildRecommendationFeed, hydrateRecommendationFeed } = await import(
      "@/lib/recommendations/service"
    );
    const feed = await buildRecommendationFeed({
      userId: auth.userId,
      plus: plus.tenantPlan === "plus",
      firstName: await viewerName(auth.userId),
      ownerScope: ownerId,
    });
    const hydrated = await hydrateRecommendationFeed(feed);
    return mobileJson({ apiVersion: "v1", ...hydrated });
  } catch (err) {
    console.error("[wave21] recommendations", err);
    return mobileError("Could not load recommendations", "RECS_ERROR", 500);
  }
}

async function handleSimilar(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  const userId = auth instanceof Response ? null : auth.userId;
  const plus =
    auth instanceof Response
      ? false
      : (await (await import("@/lib/revenue/subscription-store")).getTenantPlusStatus(auth.admin, auth.userId))
          .tenantPlan === "plus";

  try {
    const { buildMoreLikeThis } = await import("@/lib/recommendations/service");
    const result = await buildMoreLikeThis({ propertyId, userId, plus });
    return mobileJson({ apiVersion: "v1", ...result });
  } catch (err) {
    console.error("[wave21] similar", err);
    return mobileError("Could not load similar homes", "RECS_ERROR", 500);
  }
}

async function handleFeedback(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const body = await parseJsonBody<{ action?: string; propertyId?: string; ownerId?: string }>(req);
  if (body instanceof Response) return body;
  const action = FEEDBACK_ACTIONS.includes(body.action as FeedbackAction)
    ? (body.action as FeedbackAction)
    : null;
  if (!action) return mobileError("Invalid feedback action", "VALIDATION", 400);

  try {
    const { recordRecommendationFeedback } = await import("@/lib/recommendations/service");
    const result = await recordRecommendationFeedback({
      userId: auth.userId,
      action,
      propertyId: parseUuid(body.propertyId),
      ownerId: parseUuid(body.ownerId),
    });
    return mobileJson({ apiVersion: "v1", ...result });
  } catch (err) {
    console.error("[wave21] feedback", err);
    return mobileError("Could not save feedback", "RECS_ERROR", 500);
  }
}

async function handleSettings(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const body = await parseJsonBody<{ recsEnabled?: boolean; reset?: boolean }>(req);
  if (body instanceof Response) return body;
  try {
    const { updateRecommendationPrefs } = await import("@/lib/recommendations/service");
    const result = await updateRecommendationPrefs({
      userId: auth.userId,
      recsEnabled: body.recsEnabled,
      reset: body.reset === true,
    });
    return mobileJson({ apiVersion: "v1", ...result });
  } catch (err) {
    console.error("[wave21] recs settings", err);
    return mobileError("Could not update recommendation settings", "RECS_ERROR", 500);
  }
}

/** Wave 21 — personalized recommendations feed, similar homes, feedback. */
export async function tryHandleWave21(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  if (method === "GET" && rest === "/recommendations") return handleFeed(req);
  if (method === "POST" && rest === "/recommendations/feedback") return handleFeedback(req);
  if (method === "POST" && rest === "/recommendations/settings") return handleSettings(req);
  if (method === "GET" && rest.startsWith("/recommendations/similar/")) {
    const id = parseUuid(rest.slice("/recommendations/similar/".length));
    if (!id) return mobileError("Invalid property id", "VALIDATION", 400);
    return handleSimilar(req, id);
  }
  return null;
}
