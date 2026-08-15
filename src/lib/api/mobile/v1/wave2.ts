import { parseUuid, parseJsonBody } from "@/lib/api/mobile/v1/helpers";
import type { Database } from "@/integrations/supabase/types";
import {
  mobileError,
  mobileJson,
  requireMobileBearer,
  userHasRole,
  type MobileAdmin,
} from "@/lib/api/mobile/v1/auth";

const LISTER_ROLES = ["landlord", "agency", "manager"] as const;
type AppRole = Database["public"]["Enums"]["app_role"];

const ACTIVE_PORTALS = ["tenant", "landlord", "agency", "manager", "admin", "caretaker"] as const;
type ActivePortal = (typeof ACTIVE_PORTALS)[number];

const PROPERTY_LIST_SELECT =
  "id, title, description, rent_kes, deposit_kes, is_active, is_vacant, neighborhood, address, property_type, bedrooms, bathrooms, amenities, images, video_url, tour_url, authenticity_score, owner_id, organization_id, updated_at, created_at";

async function requireListerRole(admin: MobileAdmin, userId: string): Promise<Response | null> {
  for (const role of LISTER_ROLES) {
    if (await userHasRole(admin, userId, role as AppRole)) return null;
  }
  return mobileError("Lister role required", "FORBIDDEN", 403);
}

async function isAdminUser(admin: MobileAdmin, userId: string): Promise<boolean> {
  return userHasRole(admin, userId, "admin");
}

async function assertPropertyOwnerOrAdmin(
  admin: MobileAdmin,
  userId: string,
  propertyId: string,
): Promise<{ ok: true; row: Record<string, unknown> } | Response> {
  const { data: row, error } = await admin
    .from("properties")
    .select(PROPERTY_LIST_SELECT)
    .eq("id", propertyId)
    .maybeSingle();

  if (error) {
    console.error("mobile property load:", error.message);
    return mobileError("Could not load property", "PROPERTY_ERROR", 500);
  }
  if (!row) return mobileError("Property not found", "NOT_FOUND", 404);

  const ownerId = (row as { owner_id?: string | null }).owner_id ?? null;
  if (ownerId === userId || (await isAdminUser(admin, userId))) {
    return { ok: true, row: row as Record<string, unknown> };
  }
  return mobileError("Not your property", "FORBIDDEN", 403);
}

// ── Properties (owner CRUD) ──────────────────────────────────────────────────

async function handleListProperties(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const roleErr = await requireListerRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const { data: rows, error } = await auth.admin
    .from("properties")
    .select(PROPERTY_LIST_SELECT)
    .eq("owner_id", auth.userId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("mobile properties list:", error.message);
    return mobileError("Could not load properties", "PROPERTY_ERROR", 500);
  }

  return mobileJson({ apiVersion: "v1", items: rows ?? [] });
}

async function handleGetProperty(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const access = await assertPropertyOwnerOrAdmin(auth.admin, auth.userId, propertyId);
  if (access instanceof Response) return access;

  return mobileJson({ apiVersion: "v1", property: access.row });
}

type PropertyPatchBody = {
  title?: unknown;
  description?: unknown;
  rent_kes?: unknown;
  deposit_kes?: unknown;
  is_active?: unknown;
  is_vacant?: unknown;
  neighborhood?: unknown;
  address?: unknown;
  property_type?: unknown;
  bedrooms?: unknown;
  bathrooms?: unknown;
  amenities?: unknown;
  video_url?: unknown;
  tour_url?: unknown;
};

type PropertyUpdate = Database["public"]["Tables"]["properties"]["Update"];
type FieldApplier = (body: PropertyPatchBody, patch: PropertyUpdate) => Response | null;

function badRequest(message: string): Response {
  return mobileError(message, "BAD_REQUEST", 400);
}

function applyNonEmptyString(
  body: PropertyPatchBody,
  key: keyof PropertyPatchBody,
  patch: PropertyUpdate,
  dest: keyof PropertyUpdate,
  message: string,
): Response | null {
  if (!(key in body)) return null;
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) return badRequest(message);
  (patch as Record<string, unknown>)[dest as string] = value.trim();
  return null;
}

function applyDescription(body: PropertyPatchBody, patch: PropertyUpdate): Response | null {
  if (!("description" in body)) return null;
  if (typeof body.description !== "string") return badRequest("description must be a string");
  patch.description = body.description.trim() || null;
  return null;
}

function applyNullableString(
  body: PropertyPatchBody,
  key: "address" | "video_url" | "tour_url",
  patch: PropertyUpdate,
  dest: keyof PropertyUpdate,
  message: string,
): Response | null {
  if (!(key in body)) return null;
  const value = body[key];
  if (value !== null && typeof value !== "string") return badRequest(message);
  (patch as Record<string, unknown>)[dest as string] =
    typeof value === "string" ? value.trim() || null : null;
  return null;
}

function applyPropertyType(body: PropertyPatchBody, patch: PropertyUpdate): Response | null {
  if (!("property_type" in body)) return null;
  if (typeof body.property_type !== "string" || !body.property_type.trim()) {
    return badRequest("property_type must be a non-empty string");
  }
  patch.property_type = body.property_type.trim() as Database["public"]["Enums"]["property_type"];
  return null;
}

function applyNonNegNumber(
  body: PropertyPatchBody,
  key: "rent_kes",
  patch: PropertyUpdate,
  dest: keyof PropertyUpdate,
  message: string,
): Response | null {
  if (!(key in body)) return null;
  const value = body[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return badRequest(message);
  (patch as Record<string, unknown>)[dest as string] = Math.trunc(value);
  return null;
}

function applyDepositKes(body: PropertyPatchBody, patch: PropertyUpdate): Response | null {
  if (!("deposit_kes" in body)) return null;
  const value = body.deposit_kes;
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
    return badRequest("deposit_kes must be a non-negative number or null");
  }
  patch.deposit_kes = typeof value === "number" ? Math.trunc(value) : null;
  return null;
}

function applyNonNegInt(
  body: PropertyPatchBody,
  key: "bedrooms" | "bathrooms",
  patch: PropertyUpdate,
  dest: keyof PropertyUpdate,
  message: string,
): Response | null {
  if (!(key in body)) return null;
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return badRequest(message);
  }
  (patch as Record<string, unknown>)[dest as string] = value;
  return null;
}

function applyAmenities(body: PropertyPatchBody, patch: PropertyUpdate): Response | null {
  if (!("amenities" in body)) return null;
  if (!Array.isArray(body.amenities) || body.amenities.some((a) => typeof a !== "string")) {
    return badRequest("amenities must be a string array");
  }
  patch.amenities = body.amenities
    .map((a) => (a as string).trim())
    .filter(Boolean)
    .slice(0, 40);
  return null;
}

function applyBoolean(
  body: PropertyPatchBody,
  key: "is_active" | "is_vacant",
  patch: PropertyUpdate,
  dest: keyof PropertyUpdate,
  message: string,
): Response | null {
  if (!(key in body)) return null;
  const value = body[key];
  if (typeof value !== "boolean") return badRequest(message);
  (patch as Record<string, unknown>)[dest as string] = value;
  return null;
}

const PROPERTY_FIELD_APPLIERS: readonly FieldApplier[] = [
  (b, p) => applyNonEmptyString(b, "title", p, "title", "title must be a non-empty string"),
  applyDescription,
  (b, p) =>
    applyNonEmptyString(
      b,
      "neighborhood",
      p,
      "neighborhood",
      "neighborhood must be a non-empty string",
    ),
  (b, p) => applyNullableString(b, "address", p, "address", "address must be a string or null"),
  applyPropertyType,
  (b, p) =>
    applyNonNegNumber(b, "rent_kes", p, "rent_kes", "rent_kes must be a non-negative number"),
  applyDepositKes,
  (b, p) => applyNonNegInt(b, "bedrooms", p, "bedrooms", "bedrooms must be a non-negative integer"),
  (b, p) =>
    applyNonNegInt(b, "bathrooms", p, "bathrooms", "bathrooms must be a non-negative integer"),
  applyAmenities,
  (b, p) =>
    applyNullableString(b, "video_url", p, "video_url", "video_url must be a string or null"),
  (b, p) => applyNullableString(b, "tour_url", p, "tour_url", "tour_url must be a string or null"),
  (b, p) => applyBoolean(b, "is_active", p, "is_active", "is_active must be a boolean"),
  (b, p) => applyBoolean(b, "is_vacant", p, "is_vacant", "is_vacant must be a boolean"),
];

function buildPropertyPatch(body: PropertyPatchBody): PropertyUpdate | Response {
  const patch: PropertyUpdate = {};
  for (const apply of PROPERTY_FIELD_APPLIERS) {
    const err = apply(body, patch);
    if (err) return err;
  }
  if (Object.keys(patch).length === 0) {
    return badRequest("No valid fields to update");
  }
  patch.updated_at = new Date().toISOString();
  return patch;
}

async function handlePatchProperty(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const access = await assertPropertyOwnerOrAdmin(auth.admin, auth.userId, propertyId);
  if (access instanceof Response) return access;

  const body = await parseJsonBody<PropertyPatchBody>(req);
  if (body instanceof Response) return body;

  const patch = buildPropertyPatch(body);
  if (patch instanceof Response) return patch;

  const { data: row, error } = await auth.admin
    .from("properties")
    .update(patch)
    .eq("id", propertyId)
    .select(PROPERTY_LIST_SELECT)
    .single();

  if (error) {
    console.error("mobile property patch:", error.message);
    return mobileError("Could not update property", "PROPERTY_ERROR", 500);
  }

  return mobileJson({ apiVersion: "v1", property: row });
}

// ── Active portal ────────────────────────────────────────────────────────────

async function handleSetActivePortal(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ portal?: string }>(req);
  if (body instanceof Response) return body;

  const portal = body.portal;
  if (!portal || !(ACTIVE_PORTALS as readonly string[]).includes(portal)) {
    return mobileError(
      "portal must be tenant|landlord|agency|manager|admin|caretaker",
      "BAD_REQUEST",
      400,
    );
  }
  const selected = portal as ActivePortal;

  // tenant + caretaker always allowed; others need matching role (admin via userHasRole).
  if (selected !== "tenant" && selected !== "caretaker") {
    const need = selected as AppRole;
    if (!(await userHasRole(auth.admin, auth.userId, need))) {
      return mobileError(`You do not have access to the ${selected} portal`, "FORBIDDEN", 403);
    }
  }

  // Admin portal is role-gated only; profiles.active_portal check constraint omits admin.
  if (selected === "admin") {
    return mobileJson({ apiVersion: "v1", portal: selected });
  }

  const { error } = await auth.admin
    .from("profiles")
    .update({ active_portal: selected })
    .eq("id", auth.userId);

  if (error) {
    console.error("mobile active portal:", error.message);
    return mobileError("Could not update active portal", "PORTAL_ERROR", 500);
  }

  return mobileJson({ apiVersion: "v1", portal: selected });
}

// ── Property management ──────────────────────────────────────────────────────

async function handleListPmProperties(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const roleErr = await requireListerRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  try {
    const { asPmDb } = await import("@/lib/pm/access");
    const { getUserOrganizationId } = await import("@/lib/api/nyumba/nyumba-shared");
    const admin = asPmDb(auth.admin);

    const orgId = await getUserOrganizationId(auth.admin, auth.userId);
    const { data: staffRows } = await admin
      .from("pm_property_staff")
      .select("property_id")
      .eq("user_id", auth.userId);
    const staffIds = (staffRows ?? []).map((r: { property_id: string }) => r.property_id);

    let query = admin
      .from("pm_properties")
      .select("id, name, neighborhood, created_at")
      .is("deleted_at", null);

    const filters = [`owner_user_id.eq.${auth.userId}`];
    if (orgId) filters.push(`agency_id.eq.${orgId}`);
    if (staffIds.length > 0) filters.push(`id.in.(${staffIds.join(",")})`);

    if (filters.length === 1) {
      query = query.eq("owner_user_id", auth.userId);
    } else {
      query = query.or(filters.join(","));
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
    if (error) {
      console.error("mobile pm properties list:", error.message);
      return mobileError("Could not load managed properties", "PM_ERROR", 500);
    }

    return mobileJson({ apiVersion: "v1", items: data ?? [] });
  } catch (err) {
    console.error("mobile pm properties list:", err);
    return mobileJson({
      apiVersion: "v1",
      items: [],
      note: "Property management list unavailable",
    });
  }
}

// ── Providers (public) ───────────────────────────────────────────────────────

async function handleListProviders(req: Request): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const url = new URL(req.url);
  const category = (url.searchParams.get("category") ?? "").trim();

  let query = supabaseAdmin
    .from("service_providers")
    .select(
      "id, business_name, categories, areas_served, counties, description, price_range, phone, tier, verified, source_url, status",
    )
    .in("status", ["active", "approved"])
    .order("tier", { ascending: true })
    .order("verified", { ascending: false })
    .order("business_name", { ascending: true })
    .limit(50);

  if (category) {
    query = query.filter("categories", "cs", JSON.stringify([category]));
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("mobile providers list:", error.message);
    return mobileError("Could not load providers", "PROVIDER_ERROR", 500);
  }

  return mobileJson({
    apiVersion: "v1",
    items: (rows ?? []).map((row) => ({
      id: row.id,
      businessName: row.business_name,
      categories: row.categories,
      areasServed: row.areas_served,
      counties: row.counties,
      description: row.description,
      priceRange: row.price_range,
      phone: row.phone,
      tier: row.tier,
      verified: row.verified,
      sourceUrl: row.source_url,
      status: row.status,
    })),
  });
}

async function handleGetProvider(providerId: string): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Placeholder IDs from the web directory (same as getProviderById).
  try {
    const { getPlaceholderProviderById } = await import("@/data/service-placeholders");
    const placeholder = getPlaceholderProviderById(providerId);
    if (placeholder) {
      return mobileJson({ apiVersion: "v1", provider: placeholder });
    }
  } catch {
    // placeholders optional
  }

  const { data: row, error } = await supabaseAdmin
    .from("service_providers")
    .select(
      "id, business_name, categories, areas_served, counties, description, price_range, phone, tier, status, verified, source_url",
    )
    .eq("id", providerId)
    .maybeSingle();

  if (error) {
    console.error("mobile provider get:", error.message);
    return mobileError("Could not load provider", "PROVIDER_ERROR", 500);
  }
  if (!row || (row.status !== "active" && row.status !== "approved")) {
    return mobileError("Provider not found", "NOT_FOUND", 404);
  }

  return mobileJson({
    apiVersion: "v1",
    provider: {
      id: row.id,
      businessName: row.business_name,
      categories: row.categories,
      areasServed: row.areas_served,
      counties: row.counties,
      description: row.description,
      priceRange: row.price_range,
      phone: row.phone,
      tier: row.tier,
      verified: row.verified,
      sourceUrl: row.source_url,
      status: row.status,
    },
  });
}

// ── Caretaker session ────────────────────────────────────────────────────────

async function handleCaretakerSession(req: Request): Promise<Response> {
  const body = await parseJsonBody<{ phone?: string; pin?: string }>(req);
  if (body instanceof Response) return body;

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  if (!phone || phone.length < 9 || phone.length > 20) {
    return mobileError("phone required", "BAD_REQUEST", 400);
  }
  if (!/^\d{4}$/.test(pin)) {
    return mobileError("pin must be 4 digits", "BAD_REQUEST", 400);
  }

  try {
    const { verifyCaretakerLogin } = await import("@/lib/api/caretaker.functions");
    const result = await verifyCaretakerLogin({ data: { phone, pin } });
    return mobileJson({ apiVersion: "v1", ...result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Caretaker login failed";
    if (message === "Invalid phone or PIN") {
      return mobileError(message, "UNAUTHORIZED", 401);
    }
    // createServerFn may not be invokable outside its HTTP path in some runtimes
    if (
      message.includes("CARETAKER_SESSION_SECRET") ||
      message.includes("is not a function") ||
      message.includes("Cannot read")
    ) {
      console.error("mobile caretaker session not implemented path:", message);
      return mobileError("Caretaker session not available", "NOT_IMPLEMENTED", 501);
    }
    console.error("mobile caretaker session:", message);
    return mobileError(message, "CARETAKER_ERROR", 400);
  }
}

// ── Admin summary ────────────────────────────────────────────────────────────

async function handleAdminSummary(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  if (!(await isAdminUser(auth.admin, auth.userId))) {
    return mobileError("Admin role required", "FORBIDDEN", 403);
  }

  const [apps, providers, scams] = await Promise.all([
    auth.admin
      .from("portal_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    auth.admin
      .from("service_providers")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    auth.admin
      .from("scam_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return mobileJson({
    apiVersion: "v1",
    pendingPortalApplications: apps.count ?? 0,
    pendingServiceProviders: providers.count ?? 0,
    pendingScamReports: scams.count ?? 0,
    counts: {
      pendingPortalApplications: apps.count ?? 0,
      pendingServiceProviders: providers.count ?? 0,
      pendingScamReports: scams.count ?? 0,
    },
  });
}

/** Match `/prefix/:uuid`. Returns undefined if path shape doesn't match. */
function matchUuidPath(rest: string, prefix: string): string | null | undefined {
  if (!rest.startsWith(prefix)) return undefined;
  const idPart = rest.slice(prefix.length);
  if (!idPart || idPart.includes("/")) return undefined;
  return parseUuid(idPart);
}

/** Match `/prefix/:segment` without UUID validation (provider placeholders). */
function matchPathSegment(rest: string, prefix: string): string | undefined {
  if (!rest.startsWith(prefix)) return undefined;
  const idPart = rest.slice(prefix.length);
  if (!idPart || idPart.includes("/")) return undefined;
  return idPart;
}

type IdHandler = (req: Request, id: string) => Promise<Response>;

const WAVE2_EXACT: Record<string, (r: Request) => Promise<Response>> = {
  "GET /properties": handleListProperties,
  "POST /me/active-portal": handleSetActivePortal,
  "GET /property-management/properties": handleListPmProperties,
  "GET /providers": handleListProviders,
  "POST /caretakers/session": handleCaretakerSession,
  "GET /admin/summary": handleAdminSummary,
};

const PROPERTY_BY_METHOD: Record<string, IdHandler> = {
  GET: handleGetProperty,
  PATCH: handlePatchProperty,
};

/**
 * Wave 2 Mobile BFF expansions. Returns null when the path/method is not handled here.
 */
export async function tryHandleWave2(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const exactHandler = WAVE2_EXACT[`${method} ${rest}`];
  if (exactHandler) return exactHandler(req);

  const propertyId = matchUuidPath(rest, "/properties/");
  if (propertyId !== undefined) {
    if (propertyId === null) return mobileError("Invalid property id", "BAD_REQUEST", 400);
    const handler = PROPERTY_BY_METHOD[method];
    return handler ? handler(req, propertyId) : null;
  }

  if (method === "GET") {
    const providerId = matchPathSegment(rest, "/providers/");
    // Reserved paths handled in later waves (categories list, provider me).
    if (providerId !== undefined) {
      if (providerId === "me" || providerId === "categories") return null;
      return handleGetProvider(providerId);
    }
  }

  return null;
}
