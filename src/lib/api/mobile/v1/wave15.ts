import type { Database } from "@/integrations/supabase/types";
import {
  mobileError,
  mobileJson,
  requireMobileBearer,
  userHasRole,
  type MobileAdmin,
} from "@/lib/api/mobile/v1/auth";
import { parseJsonBody, parseUuid, requireAdmin } from "@/lib/api/mobile/v1/helpers";

type AppRole = Database["public"]["Enums"]["app_role"];

const PROVIDER_CATEGORIES = [
  "electricians",
  "plumbers",
  "painters",
  "internet",
  "security",
  "movers",
  "cleaning",
  "solar",
  "pest_control",
  "carpentry",
  "furniture",
  "interior_design",
  "appliance_repair",
  "gardening",
  "water_services",
  "generators",
  "moving_supplies",
  "ac_repair",
  "laundry",
  "locksmiths",
  "roofing",
  "mama_fua",
  "nanny",
  "gas_delivery",
  "delivery",
  "courier",
] as const;

const PROVIDER_TIERS = ["basic", "featured", "premium"] as const;

/** Match `/prefix/:uuid` or `/prefix/:uuid/suffix`. Returns undefined if prefix/suffix don't match. */
function matchUuidPath(rest: string, prefix: string, suffix = ""): string | null | undefined {
  if (!rest.startsWith(prefix)) return undefined;
  if (suffix && !rest.endsWith(suffix)) return undefined;
  const idPart = suffix
    ? rest.slice(prefix.length, rest.length - suffix.length)
    : rest.slice(prefix.length);
  if (!idPart || idPart.includes("/")) return undefined;
  return parseUuid(idPart);
}

async function requireLandlordRole(admin: MobileAdmin, userId: string): Promise<Response | null> {
  if (await userHasRole(admin, userId, "landlord" as AppRole)) return null;
  if (await userHasRole(admin, userId, "agency" as AppRole)) return null;
  if (await userHasRole(admin, userId, "manager" as AppRole)) return null;
  return mobileError("Lister role required", "FORBIDDEN", 403);
}

// ── Landlord analytics ───────────────────────────────────────────────────────

async function handleLandlordAnalytics(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requireLandlordRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const [{ data: properties, error: pErr }, { data: leads, error: lErr }] = await Promise.all([
    auth.admin
      .from("properties")
      .select("id, title, views, is_active, is_vacant, rent_kes, neighborhood, updated_at")
      .eq("owner_id", auth.userId)
      .limit(500),
    auth.admin
      .from("inquiries")
      .select("id, status, created_at, property_id")
      .eq("landlord_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (pErr) return mobileError(pErr.message, "ANALYTICS_ERROR", 500);
  if (lErr) return mobileError(lErr.message, "ANALYTICS_ERROR", 500);

  const rows = properties ?? [];
  const leadRows = leads ?? [];
  const totalViews = rows.reduce((s, p) => s + (p.views ?? 0), 0);
  const byProperty = rows
    .map((p) => ({
      id: p.id,
      title: p.title,
      views: p.views ?? 0,
      isActive: p.is_active,
      rentKes: p.rent_kes,
      neighborhood: p.neighborhood,
      leads: leadRows.filter((l) => l.property_id === p.id).length,
    }))
    .sort((a, b) => b.views - a.views);

  const leadsByDay: Record<string, number> = {};
  for (const lead of leadRows) {
    const day = (lead.created_at ?? "").slice(0, 10);
    if (!day) continue;
    leadsByDay[day] = (leadsByDay[day] ?? 0) + 1;
  }

  return mobileJson({
    apiVersion: "v1",
    summary: {
      totalProperties: rows.length,
      activeProperties: rows.filter((p) => p.is_active).length,
      vacantProperties: rows.filter((p) => p.is_vacant).length,
      totalViews,
      totalLeads: leadRows.length,
      newLeads: leadRows.filter((l) => l.status === "new").length,
      potentialRevenue: rows.filter((p) => p.is_active).reduce((s, p) => s + (p.rent_kes ?? 0), 0),
    },
    topListings: byProperty.slice(0, 20),
    leadsByDay: Object.entries(leadsByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30),
  });
}

// ── Compare listings ─────────────────────────────────────────────────────────

async function handleCompareListings(req: Request): Promise<Response> {
  const body = await parseJsonBody<{ ids?: string[] }>(req);
  if (body instanceof Response) return body;
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string" && !!parseUuid(id))
    : [];
  if (ids.length < 2 || ids.length > 4) {
    return mobileError("Provide 2–4 property ids", "BAD_REQUEST", 400);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("properties")
    .select(
      "id, title, neighborhood, rent_kes, property_type, bedrooms, bathrooms, is_verified, images, amenities, description",
    )
    .in("id", ids)
    .eq("is_active", true);
  if (error) return mobileError(error.message, "COMPARE_ERROR", 500);

  const order = new Map(ids.map((id, i) => [id, i]));
  const items = (data ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return mobileJson({ apiVersion: "v1", items });
}

// ── Saved searches / alerts ──────────────────────────────────────────────────

async function handleListSavedSearches(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const { data, error } = await auth.admin
    .from("saved_searches")
    .select("*")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });
  if (error) return mobileError(error.message, "SAVED_SEARCH_ERROR", 400);
  return mobileJson({ apiVersion: "v1", searches: data ?? [] });
}

async function assertSavedSearchAlertQuota(
  admin: MobileAdmin,
  userId: string,
  alertEnabled: boolean,
): Promise<Response | null> {
  if (!alertEnabled) return null;
  const { getTenantPlusStatus } = await import("@/lib/revenue/subscription-store");
  const plus = await getTenantPlusStatus(admin, userId);
  if (plus.tenantPlan === "plus") return null;

  const { count } = await admin
    .from("saved_searches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("alert_enabled", true);
  if ((count ?? 0) >= 1) {
    return mobileError(
      "Free plan allows 1 search alert. Upgrade to Plus for unlimited alerts.",
      "PLUS_REQUIRED",
      403,
    );
  }
  return null;
}

function parseSavedSearchCreateInput(body: {
  name?: string;
  filters?: Record<string, unknown>;
  alertEnabled?: boolean;
}): { name: string; filters: Record<string, unknown>; alertEnabled: boolean } | Response {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return mobileError("name is required", "BAD_REQUEST", 400);
  const alertEnabled = body.alertEnabled !== false;
  const filters =
    body.filters && typeof body.filters === "object" && !Array.isArray(body.filters)
      ? body.filters
      : {};
  return { name, filters, alertEnabled };
}

async function handleCreateSavedSearch(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{
    name?: string;
    filters?: Record<string, unknown>;
    alertEnabled?: boolean;
  }>(req);
  if (body instanceof Response) return body;

  const parsed = parseSavedSearchCreateInput(body);
  if (parsed instanceof Response) return parsed;

  try {
    const quotaErr = await assertSavedSearchAlertQuota(
      auth.admin,
      auth.userId,
      parsed.alertEnabled,
    );
    if (quotaErr) return quotaErr;

    const { data: row, error } = await auth.admin
      .from("saved_searches")
      .insert({
        user_id: auth.userId,
        name: parsed.name,
        filters:
          parsed.filters as Database["public"]["Tables"]["saved_searches"]["Insert"]["filters"],
        criteria:
          parsed.filters as Database["public"]["Tables"]["saved_searches"]["Insert"]["criteria"],
        alert_enabled: parsed.alertEnabled,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mobileJson({ apiVersion: "v1", search: row }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save search";
    return mobileError(message, "SAVED_SEARCH_ERROR", 400);
  }
}

async function handlePatchSavedSearch(req: Request, id: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ name?: string; alertEnabled?: boolean }>(req);
  if (body instanceof Response) return body;

  const patch: Database["public"]["Tables"]["saved_searches"]["Update"] = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.alertEnabled === "boolean") patch.alert_enabled = body.alertEnabled;
  if (!Object.keys(patch).length) {
    return mobileError("Nothing to update", "BAD_REQUEST", 400);
  }

  const { data: row, error } = await auth.admin
    .from("saved_searches")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("*")
    .maybeSingle();
  if (error) return mobileError(error.message, "SAVED_SEARCH_ERROR", 400);
  if (!row) return mobileError("Not found", "NOT_FOUND", 404);
  return mobileJson({ apiVersion: "v1", search: row });
}

async function handleDeleteSavedSearch(req: Request, id: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const { error } = await auth.admin
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);
  if (error) return mobileError(error.message, "SAVED_SEARCH_ERROR", 400);
  return mobileJson({ apiVersion: "v1", ok: true });
}

// ── Admin create provider / listing / verify ─────────────────────────────────

type ProviderCreateBody = {
  businessName?: string;
  categories?: string[];
  areasServed?: string[];
  counties?: string[];
  description?: string;
  priceRange?: string;
  phone?: string;
  sourceUrl?: string;
  tier?: string;
  verified?: boolean;
};

type ParsedProviderCreate = {
  businessName: string;
  categories: string[];
  areasServed: string[];
  counties: string[];
  description: string | null;
  priceRange: string | null;
  phone: string | null;
  sourceUrl: string | null;
  tier: string;
  verified: number;
};

function stringList(value: unknown, predicate: (s: string) => boolean): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && predicate(v));
}

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalTrimmed(value: unknown): string | null {
  const trimmed = trimString(value);
  return trimmed || null;
}

function resolveProviderTier(tier: unknown): string {
  if (typeof tier === "string" && (PROVIDER_TIERS as readonly string[]).includes(tier)) {
    return tier;
  }
  return "basic";
}

function resolveCounties(counties: unknown): string[] {
  if (!Array.isArray(counties) || !counties.length) return ["Nairobi"];
  return stringList(counties, (c) => c.trim().length > 0);
}

function validateProviderCreateFields(
  businessName: string,
  categories: string[],
  areasServed: string[],
  phone: string,
  sourceUrl: string,
): Response | null {
  if (businessName.length < 2) return mobileError("businessName required", "BAD_REQUEST", 400);
  if (!categories.length) return mobileError("categories required", "BAD_REQUEST", 400);
  if (!areasServed.length) return mobileError("areasServed required", "BAD_REQUEST", 400);
  if (!phone && !sourceUrl) {
    return mobileError("Add a phone number or website URL", "BAD_REQUEST", 400);
  }
  return null;
}

function parseProviderCreateBody(body: ProviderCreateBody): ParsedProviderCreate | Response {
  const businessName = trimString(body.businessName);
  const categories = stringList(body.categories, (c) =>
    (PROVIDER_CATEGORIES as readonly string[]).includes(c),
  );
  const areasServed = stringList(body.areasServed, (a) => a.trim().length > 0);
  const phone = trimString(body.phone);
  const sourceUrl = trimString(body.sourceUrl);

  const validationErr = validateProviderCreateFields(
    businessName,
    categories,
    areasServed,
    phone,
    sourceUrl,
  );
  if (validationErr) return validationErr;

  return {
    businessName,
    categories,
    areasServed,
    counties: resolveCounties(body.counties),
    description: optionalTrimmed(body.description),
    priceRange: optionalTrimmed(body.priceRange),
    phone: phone || null,
    sourceUrl: sourceUrl || null,
    tier: resolveProviderTier(body.tier),
    verified: body.verified ? 1 : 0,
  };
}

async function handleAdminCreateProvider(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<ProviderCreateBody>(req);
  if (body instanceof Response) return body;

  const parsed = parseProviderCreateBody(body);
  if (parsed instanceof Response) return parsed;

  const { data: row, error } = await auth.admin
    .from("service_providers")
    .insert({
      user_id: null,
      business_name: parsed.businessName,
      categories: parsed.categories,
      areas_served: parsed.areasServed,
      counties: parsed.counties,
      description: parsed.description,
      price_range: parsed.priceRange,
      phone: parsed.phone,
      source_url: parsed.sourceUrl,
      tier: parsed.tier,
      status: "active",
      verified: parsed.verified,
    })
    .select("id")
    .single();
  if (error) return mobileError(error.message, "ADMIN_ERROR", 400);

  await auth.admin.from("admin_audit_logs").insert({
    admin_id: auth.userId,
    action: "SERVICE_PROVIDER_CREATED",
    target_id: row.id,
    details: `Created directory listing ${parsed.businessName} (${parsed.tier})`,
  });

  return mobileJson({ apiVersion: "v1", id: row.id }, 201);
}

type PropertyCreateBody = {
  title?: string;
  neighborhood?: string;
  propertyType?: string;
  rentKes?: number;
  bedrooms?: number;
  bathrooms?: number;
  description?: string;
  contactName?: string;
  contactPhone?: string;
  isActive?: boolean;
};

type ParsedPropertyCreate = {
  title: string;
  neighborhood: string;
  contactName: string;
  contactPhone: string;
  rentKes: number;
  bedrooms: number;
  bathrooms: number;
  description: string | null;
  isActive: boolean;
};

function parsePropertyCreateBody(body: PropertyCreateBody): ParsedPropertyCreate | Response {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const neighborhood = typeof body.neighborhood === "string" ? body.neighborhood.trim() : "";
  const contactName = typeof body.contactName === "string" ? body.contactName.trim() : "";
  const contactPhone = typeof body.contactPhone === "string" ? body.contactPhone.trim() : "";
  const rentKes = typeof body.rentKes === "number" ? body.rentKes : Number(body.rentKes);

  if (title.length < 3) return mobileError("title required", "BAD_REQUEST", 400);
  if (neighborhood.length < 2) return mobileError("neighborhood required", "BAD_REQUEST", 400);
  if (!Number.isFinite(rentKes) || rentKes < 1) {
    return mobileError("rentKes required", "BAD_REQUEST", 400);
  }
  if (contactName.length < 2) return mobileError("contactName required", "BAD_REQUEST", 400);
  if (contactPhone.length < 9) return mobileError("contactPhone required", "BAD_REQUEST", 400);

  return {
    title,
    neighborhood,
    contactName,
    contactPhone,
    rentKes: Math.trunc(rentKes),
    bedrooms: typeof body.bedrooms === "number" ? body.bedrooms : 1,
    bathrooms: typeof body.bathrooms === "number" ? body.bathrooms : 1,
    description:
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null,
    isActive: body.isActive !== false,
  };
}

async function handleAdminCreateProperty(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<PropertyCreateBody>(req);
  if (body instanceof Response) return body;

  const parsed = parsePropertyCreateBody(body);
  if (parsed instanceof Response) return parsed;

  const propertyType = "one_bedroom" as const;

  const { data: row, error } = await auth.admin
    .from("properties")
    .insert({
      owner_id: auth.userId,
      title: parsed.title,
      neighborhood: parsed.neighborhood,
      property_type: propertyType,
      rent_kes: parsed.rentKes,
      bedrooms: parsed.bedrooms,
      bathrooms: parsed.bathrooms,
      description: parsed.description,
      contact_name: parsed.contactName,
      contact_phone: parsed.contactPhone,
      contact_phones: [parsed.contactPhone],
      is_active: parsed.isActive,
      is_vacant: true,
      whatsapp_inquiries: true,
      images: [],
    })
    .select("id, title, is_active")
    .single();
  if (error) return mobileError(error.message, "ADMIN_ERROR", 400);

  await auth.admin.from("admin_audit_logs").insert({
    admin_id: auth.userId,
    action: "PROPERTY_CREATED_BY_ADMIN",
    target_id: row.id,
    details: JSON.stringify({
      title: parsed.title,
      neighborhood: parsed.neighborhood,
      contactPhone: parsed.contactPhone,
      contactName: parsed.contactName,
    }),
  });

  try {
    const { invalidateListingCaches } = await import("@/lib/cache/manager");
    await invalidateListingCaches();
  } catch {
    // best-effort
  }

  return mobileJson({ apiVersion: "v1", property: row }, 201);
}

async function handleAdminSetVerified(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ isVerified?: boolean }>(req);
  if (body instanceof Response) return body;
  if (typeof body.isVerified !== "boolean") {
    return mobileError("isVerified must be a boolean", "BAD_REQUEST", 400);
  }

  const { data: row, error } = await auth.admin
    .from("properties")
    .update({
      is_verified: body.isVerified,
      updated_at: new Date().toISOString(),
    })
    .eq("id", propertyId)
    .select("id, title, is_verified")
    .maybeSingle();
  if (error) return mobileError(error.message, "ADMIN_ERROR", 400);
  if (!row) return mobileError("Listing not found", "NOT_FOUND", 404);

  await auth.admin.from("admin_audit_logs").insert({
    admin_id: auth.userId,
    action: body.isVerified ? "PROPERTY_VERIFIED" : "PROPERTY_UNVERIFIED",
    target_id: propertyId,
    details: `${body.isVerified ? "Verified" : "Unverified"} listing: ${row.title}`,
  });

  return mobileJson({ apiVersion: "v1", property: row });
}

type IdHandler = (req: Request, id: string) => Promise<Response>;

/**
 * Wave 15 Mobile BFF — analytics, compare, saved searches, admin create/verify.
 */
export async function tryHandleWave15(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const exact: Record<string, (r: Request) => Promise<Response>> = {
    "GET /landlords/analytics": handleLandlordAnalytics,
    "POST /listings/compare": handleCompareListings,
    "GET /saved-searches": handleListSavedSearches,
    "POST /saved-searches": handleCreateSavedSearch,
    "POST /admin/service-providers/create": handleAdminCreateProvider,
    "POST /admin/properties": handleAdminCreateProperty,
  };

  const exactHandler = exact[`${method} ${rest}`];
  if (exactHandler) return exactHandler(req);

  const savedId = matchUuidPath(rest, "/saved-searches/");
  if (savedId !== undefined) {
    if (savedId === null) return mobileError("Invalid id", "BAD_REQUEST", 400);
    const savedByMethod: Record<string, IdHandler> = {
      PATCH: handlePatchSavedSearch,
      DELETE: handleDeleteSavedSearch,
    };
    const handler = savedByMethod[method];
    return handler ? handler(req, savedId) : null;
  }

  if (method === "POST") {
    const verifyId = matchUuidPath(rest, "/admin/properties/", "/verified");
    if (verifyId !== undefined) {
      if (verifyId === null) return mobileError("Invalid property id", "BAD_REQUEST", 400);
      return handleAdminSetVerified(req, verifyId);
    }
  }

  return null;
}
