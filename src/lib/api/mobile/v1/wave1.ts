import { parseUuid, parseJsonBody } from "@/lib/api/mobile/v1/helpers";
import { mobileError, mobileJson, requireMobileBearer } from "@/lib/api/mobile/v1/auth";
import { isKenyanPhone } from "@/lib/phone";

// ── Notifications ────────────────────────────────────────────────────────────

async function handleListNotifications(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.trunc(limitRaw))) : 30;
  const unreadOnly =
    url.searchParams.get("unreadOnly") === "1" || url.searchParams.get("unreadOnly") === "true";
  const before = url.searchParams.get("before") ?? undefined;

  let q = auth.admin
    .from("notifications")
    .select("id, type, title, body, href, entity_type, entity_id, read_at, created_at, metadata")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) q = q.is("read_at", null);
  if (before) q = q.lt("created_at", before);

  const { data: rows, error } = await q;
  if (error) {
    console.error("mobile notifications list:", error.message);
    return mobileError("Could not load notifications", "NOTIFICATIONS_ERROR", 500);
  }

  return mobileJson({
    apiVersion: "v1",
    items: (rows ?? []).map((r) => ({
      id: r.id as string,
      type: r.type as string,
      title: r.title as string,
      body: r.body as string,
      href: (r.href as string | null) ?? null,
      entityType: (r.entity_type as string | null) ?? null,
      entityId: (r.entity_id as string | null) ?? null,
      readAt: (r.read_at as string | null) ?? null,
      createdAt: r.created_at as string,
    })),
  });
}

async function handleMarkNotificationsRead(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ id?: string; all?: boolean }>(req);
  if (body instanceof Response) return body;

  const readAt = new Date().toISOString();

  if (body.all) {
    const { error } = await auth.admin
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", auth.userId)
      .is("read_at", null);
    if (error) {
      console.error("mobile notifications mark all read:", error.message);
      return mobileError("Could not mark notifications read", "NOTIFICATIONS_ERROR", 500);
    }
    return mobileJson({ apiVersion: "v1", success: true, all: true });
  }

  const id = parseUuid(body.id);
  if (!id) return mobileError("id or all required", "BAD_REQUEST", 400);

  const { error } = await auth.admin
    .from("notifications")
    .update({ read_at: readAt })
    .eq("id", id)
    .eq("user_id", auth.userId)
    .is("read_at", null);
  if (error) {
    console.error("mobile notifications mark read:", error.message);
    return mobileError("Could not mark notification read", "NOTIFICATIONS_ERROR", 500);
  }
  return mobileJson({ apiVersion: "v1", success: true, id });
}

async function handleUnreadNotificationCount(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const { count, error } = await auth.admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.userId)
    .is("read_at", null);
  if (error) {
    console.error("mobile notifications unread count:", error.message);
    return mobileError("Could not load unread count", "NOTIFICATIONS_ERROR", 500);
  }
  return mobileJson({ apiVersion: "v1", count: count ?? 0 });
}

// ── Subscriptions catalog ────────────────────────────────────────────────────

async function handleSubscriptionsCatalog(): Promise<Response> {
  const {
    LANDLORD_PLANS,
    AGENCY_PLANS,
    MANAGER_PLANS,
    PROVIDER_TIERS,
    BOOST_PACKAGES,
    LEAD_PACKS,
  } = await import("@/lib/revenue/plans");
  const { PM_FALLBACK_TIER } = await import("@/lib/pm/pricing");

  let pmTiers: Array<{ id: string; tier_name: string; max_units: number; price_kes: number }> = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asPmDb } = await import("@/lib/pm/access");
    const { data } = await asPmDb(supabaseAdmin)
      .from("pm_pricing_tiers")
      .select("id, tier_name, max_units, price_kes")
      .order("price_kes", { ascending: true });
    pmTiers = (data ?? []) as typeof pmTiers;
  } catch (err) {
    console.warn("mobile subscriptions catalog pm tiers:", err);
  }

  return mobileJson({
    apiVersion: "v1",
    landlord: LANDLORD_PLANS,
    agency: AGENCY_PLANS,
    manager: MANAGER_PLANS,
    plus: await import("@/lib/revenue/platform-settings").then((m) => m.resolvePlusPricing()),
    providerTiers: PROVIDER_TIERS,
    boostPackages: BOOST_PACKAGES,
    leadPacks: LEAD_PACKS,
    pmTiers,
    pmFallbackTier: PM_FALLBACK_TIER,
  });
}

// ── Reviews ──────────────────────────────────────────────────────────────────

async function handleListListingReviews(propertyId: string): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("property_reviews")
    .select(
      `
      *,
      profiles:reviewer_id (
        full_name,
        avatar_url
      )
    `,
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("mobile listing reviews:", error.message);
    return mobileError("Could not load reviews", "REVIEWS_ERROR", 500);
  }
  return mobileJson({ apiVersion: "v1", items: rows ?? [] });
}

async function handleCreatePropertyReview(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{
    propertyId?: string;
    ratingOverall?: number;
    waterReliability?: number;
    securityRating?: number;
    internetReliability?: number;
    electricityReliability?: number;
    cleanliness?: number;
    accessibility?: number;
    comment?: string;
  }>(req);
  if (body instanceof Response) return body;

  const propertyId = parseUuid(body.propertyId);
  if (!propertyId) return mobileError("propertyId required", "BAD_REQUEST", 400);

  const ratings = [
    body.ratingOverall,
    body.waterReliability,
    body.securityRating,
    body.internetReliability,
    body.electricityReliability,
    body.cleanliness,
    body.accessibility,
  ];
  if (ratings.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 1 || n > 5)) {
    return mobileError("All ratings must be numbers from 1 to 5", "BAD_REQUEST", 400);
  }

  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : undefined;

  // Occupancy gate: user must have completed viewing or active tenancy (admin read — RLS-safe)
  const [{ data: completedViewing }, { data: tenancy }] = await Promise.all([
    auth.admin
      .from("viewings")
      .select("id")
      .eq("property_id", propertyId)
      .eq("tenant_id", auth.userId)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle(),
    auth.admin
      .from("tenancies")
      .select("id")
      .eq("property_id", propertyId)
      .eq("tenant_id", auth.userId)
      .in("status", ["active", "completed"])
      .limit(1)
      .maybeSingle(),
  ]);

  if (!completedViewing && !tenancy) {
    return mobileError(
      "You can only review a property after completing a viewing or tenancy. Book a viewing first.",
      "FORBIDDEN",
      403,
    );
  }

  const { data: row, error } = await auth.admin
    .from("property_reviews")
    .insert({
      property_id: propertyId,
      reviewer_id: auth.userId,
      rating_overall: body.ratingOverall!,
      water_reliability: Math.trunc(body.waterReliability!),
      security_rating: Math.trunc(body.securityRating!),
      internet_reliability: Math.trunc(body.internetReliability!),
      electricity_reliability: Math.trunc(body.electricityReliability!),
      cleanliness: Math.trunc(body.cleanliness!),
      accessibility: Math.trunc(body.accessibility!),
      comment: comment ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("mobile create review:", error.message);
    return mobileError(error.message, "REVIEWS_ERROR", 400);
  }
  return mobileJson({ apiVersion: "v1", review: row }, 201);
}

// ── Tenant rent ──────────────────────────────────────────────────────────────

async function handleTenantRentInvoices(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const { loadTenantInvoicesForUser } = await import("@/lib/api/pm-tenant-rent.functions");
  const items = await loadTenantInvoicesForUser(auth.userId);
  return mobileJson({ apiVersion: "v1", items });
}

async function handleTenantRentAccess(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const { resolveTenantPmAccess } = await import("@/lib/api/pm-tenant-rent.functions");
  const access = await resolveTenantPmAccess(auth.userId);
  return mobileJson({ apiVersion: "v1", ...access });
}

async function handleTenantRentPay(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{
    invoiceId?: string;
    phone?: string;
    amountKes?: number;
    idempotencyKey?: string;
  }>(req);
  if (body instanceof Response) return body;

  const invoiceId = parseUuid(body.invoiceId);
  if (!invoiceId) return mobileError("invoiceId required", "BAD_REQUEST", 400);

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!phone || !isKenyanPhone(phone)) {
    return mobileError("Invalid Safaricom phone number", "BAD_REQUEST", 400);
  }

  if (
    body.amountKes !== undefined &&
    (typeof body.amountKes !== "number" || !Number.isInteger(body.amountKes) || body.amountKes <= 0)
  ) {
    return mobileError("amountKes must be a positive integer", "BAD_REQUEST", 400);
  }

  if (
    body.idempotencyKey !== undefined &&
    (typeof body.idempotencyKey !== "string" ||
      body.idempotencyKey.length < 8 ||
      body.idempotencyKey.length > 64)
  ) {
    return mobileError("idempotencyKey must be 8–64 characters", "BAD_REQUEST", 400);
  }

  try {
    const { payPmRentCore } = await import("@/lib/api/pm-tenant-rent.functions");
    const result = await payPmRentCore(auth.userId, {
      invoiceId,
      phone,
      amountKes: body.amountKes,
      idempotencyKey: body.idempotencyKey,
    });
    return mobileJson({ apiVersion: "v1", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment failed";
    console.error("mobile rent pay:", message);
    return mobileError(message, "RENT_PAY_ERROR", 400);
  }
}

/**
 * Wave 1 Mobile BFF expansions. Returns null when the path/method is not handled here.
 */
export async function tryHandleWave1(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const exact: Record<string, (r: Request) => Promise<Response>> = {
    "GET /notifications": handleListNotifications,
    "POST /notifications/read": handleMarkNotificationsRead,
    "GET /notifications/unread-count": handleUnreadNotificationCount,
    "GET /subscriptions/catalog": () => handleSubscriptionsCatalog(),
    "POST /reviews": handleCreatePropertyReview,
    "GET /tenants/rent/invoices": handleTenantRentInvoices,
    "GET /tenants/rent/access": handleTenantRentAccess,
    "POST /tenants/rent/pay": handleTenantRentPay,
  };

  const exactKey = `${method} ${rest}`;
  const exactHandler = exact[exactKey];
  if (exactHandler) return exactHandler(req);

  const listingReviewsMatch = /^\/listings\/([^/]+)\/reviews$/.exec(rest);
  if (listingReviewsMatch && method === "GET") {
    const id = parseUuid(listingReviewsMatch[1]);
    if (!id) return mobileError("Invalid listing id", "BAD_REQUEST", 400);
    return handleListListingReviews(id);
  }

  return null;
}
