import { parseUuid, parseJsonBody, mapPmError } from "@/lib/api/mobile/v1/helpers";
import type { Database } from "@/integrations/supabase/types";
import {
  mobileError,
  mobileJson,
  requireMobileBearer,
  userHasRole,
  type MobileAdmin,
} from "@/lib/api/mobile/v1/auth";
import { initiatePaymentSchema } from "@/lib/payments/initiate-payment-core";
import { z } from "zod";

type AppRole = Database["public"]["Enums"]["app_role"];

const PROPERTY_SAFE_SELECT =
  "id, title, description, rent_kes, is_active, is_vacant, neighborhood, property_type, bedrooms, bathrooms, images, owner_id, organization_id, pricing_mode, updated_at, created_at";

const CHECKOUT_PAYMENT_TYPES = [
  "tenant_plus",
  "landlord_plan",
  "premium_subscription",
  "pm_module",
  "property_boost",
  "lead_pack",
  "provider_subscription",
  "verification",
] as const;

const LISTER_ROLES = ["landlord", "agency", "manager", "admin"] as const;

function zodMessage(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid request";
}

async function requireListerOrAdmin(admin: MobileAdmin, userId: string): Promise<Response | null> {
  for (const role of LISTER_ROLES) {
    if (await userHasRole(admin, userId, role as AppRole)) return null;
  }
  return mobileError("Lister role required", "FORBIDDEN", 403);
}

async function loadUserRoles(admin: MobileAdmin, userId: string): Promise<Set<string>> {
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.role));
}

// ── Subscriptions checkout ───────────────────────────────────────────────────

async function handleSubscriptionsCheckout(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<Record<string, unknown>>(req);
  if (body instanceof Response) return body;

  const paymentType = body.paymentType;
  if (
    typeof paymentType !== "string" ||
    !(CHECKOUT_PAYMENT_TYPES as readonly string[]).includes(paymentType)
  ) {
    return mobileError(
      "paymentType must be tenant_plus|landlord_plan|premium_subscription|pm_module|property_boost|lead_pack|provider_subscription|verification",
      "BAD_REQUEST",
      400,
    );
  }

  const defaultSuccessPath = paymentType === "tenant_plus" ? "/plus" : "/portals";
  const payload = {
    ...body,
    paymentType,
    successPath:
      typeof body.successPath === "string" && body.successPath.trim()
        ? body.successPath.trim()
        : defaultSuccessPath,
  };

  const parsed = initiatePaymentSchema.safeParse(payload);
  if (!parsed.success) {
    return mobileError(zodMessage(parsed.error), "BAD_REQUEST", 400);
  }

  try {
    const { initiatePaymentCore } = await import("@/lib/payments/initiate-payment-core");
    const result = await initiatePaymentCore(auth.userId, parsed.data);
    return mobileJson({ apiVersion: "v1", ...result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return mobileError(zodMessage(err), "BAD_REQUEST", 400);
    }
    const message = err instanceof Error ? err.message : "Checkout failed";
    return mobileError(message, "BAD_REQUEST", 400);
  }
}

// ── Create property ──────────────────────────────────────────────────────────

type CreatePropertyBody = {
  title?: unknown;
  neighborhood?: unknown;
  property_type?: unknown;
  rent_kes?: unknown;
  bedrooms?: unknown;
  bathrooms?: unknown;
  description?: unknown;
  pricing_mode?: unknown;
  is_active?: unknown;
  amenities?: unknown;
  deposit_kes?: unknown;
  address?: unknown;
  video_url?: unknown;
  location_id?: unknown;
};

type ParsedCreateProperty = {
  title: string;
  neighborhood: string;
  propertyType: string;
  rentKes: number;
  bedrooms: number;
  bathrooms: number;
  description: string | null;
  pricingMode?: Database["public"]["Enums"]["pricing_mode"];
  isActive: boolean;
  amenities?: string[];
  depositKes?: number;
  address?: string;
  videoUrl?: string;
  locationId?: string;
};

function parseNonNegInt(value: unknown, field: string): number | Response {
  if (value === undefined || value === null) return 0;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return mobileError(`${field} must be a non-negative integer`, "BAD_REQUEST", 400);
  }
  return value;
}

function applyOptionalTextFields(body: CreatePropertyBody, parsed: ParsedCreateProperty): void {
  if (Array.isArray(body.amenities)) {
    parsed.amenities = body.amenities
      .filter((a): a is string => typeof a === "string")
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, 40);
  }
  if (
    typeof body.deposit_kes === "number" &&
    Number.isFinite(body.deposit_kes) &&
    body.deposit_kes >= 0
  ) {
    parsed.depositKes = Math.trunc(body.deposit_kes);
  }
  if (typeof body.address === "string" && body.address.trim()) {
    parsed.address = body.address.trim();
  }
  if (typeof body.video_url === "string" && body.video_url.trim()) {
    parsed.videoUrl = body.video_url.trim();
  }
}

function applyOptionalCreateFields(
  body: CreatePropertyBody,
  parsed: ParsedCreateProperty,
): ParsedCreateProperty | Response {
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") {
      return mobileError("description must be a string", "BAD_REQUEST", 400);
    }
    parsed.description = body.description.trim() || null;
  }

  if (body.pricing_mode !== undefined && body.pricing_mode !== null) {
    if (
      body.pricing_mode !== "rent" &&
      body.pricing_mode !== "sale" &&
      body.pricing_mode !== "booking"
    ) {
      return mobileError("pricing_mode must be rent|sale|booking", "BAD_REQUEST", 400);
    }
    parsed.pricingMode = body.pricing_mode;
  }

  if (body.is_active !== undefined && body.is_active !== null) {
    if (typeof body.is_active !== "boolean") {
      return mobileError("is_active must be a boolean", "BAD_REQUEST", 400);
    }
    parsed.isActive = body.is_active;
  }

  applyOptionalTextFields(body, parsed);
  if (typeof body.location_id === "string") {
    const id = parseUuid(body.location_id);
    if (id) parsed.locationId = id;
  }
  return parsed;
}

function parseCreatePropertyBody(body: CreatePropertyBody): ParsedCreateProperty | Response {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const neighborhood = typeof body.neighborhood === "string" ? body.neighborhood.trim() : "";
  const propertyType = typeof body.property_type === "string" ? body.property_type.trim() : "";
  if (!title) return mobileError("title is required", "BAD_REQUEST", 400);
  if (!neighborhood) return mobileError("neighborhood is required", "BAD_REQUEST", 400);
  if (!propertyType) return mobileError("property_type is required", "BAD_REQUEST", 400);
  if (
    typeof body.rent_kes !== "number" ||
    !Number.isFinite(body.rent_kes) ||
    !Number.isInteger(body.rent_kes) ||
    body.rent_kes < 1
  ) {
    return mobileError("rent_kes must be a positive integer", "BAD_REQUEST", 400);
  }

  const bedrooms = parseNonNegInt(body.bedrooms, "bedrooms");
  if (bedrooms instanceof Response) return bedrooms;
  const bathrooms = parseNonNegInt(body.bathrooms, "bathrooms");
  if (bathrooms instanceof Response) return bathrooms;

  return applyOptionalCreateFields(body, {
    title,
    neighborhood,
    propertyType,
    rentKes: body.rent_kes,
    bedrooms,
    bathrooms,
    description: null,
    isActive: true,
  });
}

async function enforceMobileListingCap(
  admin: MobileAdmin,
  userId: string,
  isActive: boolean,
): Promise<Response | null> {
  try {
    const { getListingCap, countActiveListings, listingCapReachedMessage } = await import(
      "@/lib/promo/listing-cap"
    );
    const [cap, activeCount] = await Promise.all([
      getListingCap(admin, userId),
      countActiveListings(admin, userId),
    ]);
    if (cap <= 0 || (isActive && activeCount >= cap)) {
      return mobileError(listingCapReachedMessage(cap), "LISTING_CAP", 403);
    }
    return null;
  } catch (err) {
    console.error("mobile listing cap:", err);
    return mobileError("Could not check listing cap", "PROPERTY_ERROR", 500);
  }
}

function toPropertyInsert(userId: string, parsed: ParsedCreateProperty) {
  type PropertyInsert = Database["public"]["Tables"]["properties"]["Insert"];
  const insert: PropertyInsert = {
    title: parsed.title,
    neighborhood: parsed.neighborhood,
    property_type: parsed.propertyType as Database["public"]["Enums"]["property_type"],
    rent_kes: parsed.rentKes,
    bedrooms: parsed.bedrooms,
    bathrooms: parsed.bathrooms,
    description: parsed.description,
    is_active: parsed.isActive,
    owner_id: userId,
    is_vacant: true,
    images: [],
  };
  if (parsed.pricingMode) insert.pricing_mode = parsed.pricingMode;
  if (parsed.amenities) insert.amenities = parsed.amenities;
  if (parsed.depositKes !== undefined) insert.deposit_kes = parsed.depositKes;
  if (parsed.address) insert.address = parsed.address;
  if (parsed.videoUrl) insert.video_url = parsed.videoUrl;
  return insert;
}

async function attachLocationFks(
  admin: MobileAdmin,
  propertyId: string,
  neighborhood: string,
  locationId?: string,
): Promise<void> {
  try {
    const { createPublicClient } = await import("@/lib/api/public-client");
    const { resolveLocation } = await import("@/lib/locations/resolve");
    const { getLocationAncestors } = await import("@/lib/locations/hierarchy");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const db = asLooseDb(admin);

    let resolvedId = locationId ?? null;
    let confidence = locationId ? 90 : 0;
    let needsReview = !locationId;
    if (!resolvedId) {
      const hit = await resolveLocation(createPublicClient(), neighborhood);
      if (!hit) return;
      resolvedId = hit.id;
      confidence = hit.matchConfidence;
      needsReview = hit.needsReview;
    }

    const ancestors = await getLocationAncestors(createPublicClient(), resolvedId);
    const { getLocationById } = await import("@/lib/locations/hierarchy");
    const self = await getLocationById(createPublicClient(), resolvedId);
    const chain = self ? [self, ...ancestors] : ancestors;
    const county = chain.find((a) => a.type === "COUNTY");
    const constituency = chain.find((a) => a.type === "CONSTITUENCY");
    const ward = chain.find((a) => a.type === "WARD");

    await db
      .from("properties")
      .update({
        location_id: resolvedId,
        county_location_id: county?.id ?? null,
        constituency_location_id: constituency?.id ?? null,
        ward_location_id: ward?.id ?? null,
        location_match_confidence: confidence,
        location_needs_review: needsReview,
      })
      .eq("id", propertyId);
  } catch (err) {
    console.warn("mobile property location attach:", err);
  }
}

async function handleCreateProperty(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const roleErr = await requireListerOrAdmin(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<CreatePropertyBody>(req);
  if (body instanceof Response) return body;

  const parsed = parseCreatePropertyBody(body);
  if (parsed instanceof Response) return parsed;

  const capErr = await enforceMobileListingCap(auth.admin, auth.userId, parsed.isActive);
  if (capErr) return capErr;

  const { data: row, error } = await auth.admin
    .from("properties")
    .insert(toPropertyInsert(auth.userId, parsed))
    .select(PROPERTY_SAFE_SELECT)
    .single();

  if (error) {
    console.error("mobile property create:", error.message);
    return mobileError("Could not create property", "PROPERTY_ERROR", 500);
  }

  await attachLocationFks(auth.admin, row.id, parsed.neighborhood, parsed.locationId);

  return mobileJson({ apiVersion: "v1", property: row }, 201);
}

// ── Messages (inquiries) ─────────────────────────────────────────────────────

async function handleListMessages(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const roles = await loadUserRoles(auth.admin, auth.userId);
  const isLister =
    roles.has("landlord") || roles.has("agency") || roles.has("manager") || roles.has("admin");

  let query = auth.admin
    .from("inquiries")
    .select(
      "id, property_id, tenant_id, landlord_id, message, status, updated_at, created_at, properties(title)",
    )
    .order("updated_at", { ascending: false })
    .limit(50);

  if (isLister) {
    query = query.eq("landlord_id", auth.userId);
  } else {
    query = query.eq("tenant_id", auth.userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("mobile messages list:", error.message);
    return mobileError("Could not load messages", "MESSAGES_ERROR", 500);
  }

  return mobileJson({ apiVersion: "v1", items: data ?? [] });
}

async function assertMessageParticipant(
  admin: MobileAdmin,
  userId: string,
  inquiryId: string,
): Promise<
  | {
      ok: true;
      inquiry: Record<string, unknown>;
    }
  | Response
> {
  const { data: inquiry, error } = await admin
    .from("inquiries")
    .select(
      "id, property_id, tenant_id, landlord_id, message, status, updated_at, created_at, properties(title)",
    )
    .eq("id", inquiryId)
    .maybeSingle();

  if (error) {
    console.error("mobile message load:", error.message);
    return mobileError("Could not load conversation", "MESSAGES_ERROR", 500);
  }
  if (!inquiry) return mobileError("Conversation not found", "NOT_FOUND", 404);

  const row = inquiry as {
    tenant_id: string | null;
    landlord_id: string | null;
  };
  if (row.tenant_id !== userId && row.landlord_id !== userId) {
    return mobileError("Not a participant in this conversation", "FORBIDDEN", 403);
  }

  return { ok: true, inquiry: inquiry as Record<string, unknown> };
}

async function handleGetMessage(req: Request, inquiryId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const access = await assertMessageParticipant(auth.admin, auth.userId, inquiryId);
  if (access instanceof Response) return access;

  const { data: messages, error } = await auth.admin
    .from("inquiry_messages")
    .select("id, inquiry_id, sender_id, body, read_at, created_at")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("mobile message thread:", error.message);
    return mobileError("Could not load messages", "MESSAGES_ERROR", 500);
  }

  return mobileJson({
    apiVersion: "v1",
    inquiry: access.inquiry,
    messages: messages ?? [],
  });
}

async function handlePostMessage(req: Request, inquiryId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const access = await assertMessageParticipant(auth.admin, auth.userId, inquiryId);
  if (access instanceof Response) return access;

  const body = await parseJsonBody<{ body?: unknown }>(req);
  if (body instanceof Response) return body;

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return mobileError("body is required", "BAD_REQUEST", 400);
  if (text.length > 1000) return mobileError("body too long", "BAD_REQUEST", 400);

  const { data: message, error } = await auth.admin
    .from("inquiry_messages")
    .insert({
      inquiry_id: inquiryId,
      sender_id: auth.userId,
      body: text,
    })
    .select("id, inquiry_id, sender_id, body, read_at, created_at")
    .single();

  if (error) {
    console.error("mobile message send:", error.message);
    return mobileError("Could not send message", "MESSAGES_ERROR", 500);
  }

  await auth.admin
    .from("inquiries")
    .update({ updated_at: new Date().toISOString(), message: text })
    .eq("id", inquiryId);

  return mobileJson({ apiVersion: "v1", message }, 201);
}

async function requirePlusToMessage(admin: MobileAdmin, userId: string): Promise<Response | null> {
  const { getTenantPlusStatus } = await import("@/lib/revenue/subscription-store");
  const plus = await getTenantPlusStatus(admin, userId);
  if (plus.tenantPlan === "plus") return null;
  return mobileError(
    "NyumbaSearch Plus is required to message landlords.",
    "PLUS_REQUIRED",
    402,
  );
}

async function loadActiveListingForMessage(admin: MobileAdmin, propertyId: string) {
  const { data: property, error } = await admin
    .from("properties")
    .select("id, owner_id, title")
    .eq("id", propertyId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("mobile create message property:", error.message);
    return mobileError("Could not load listing", "MESSAGES_ERROR", 500);
  }
  if (!property?.owner_id) {
    return mobileError("Landlord contact is unavailable for this listing", "BAD_REQUEST", 400);
  }
  return { id: property.id, owner_id: property.owner_id, title: property.title };
}

async function loadOrCreateInquiry(
  admin: MobileAdmin,
  userId: string,
  property: { id: string; owner_id: string },
  text: string,
) {
  const { data: existingInquiry, error: existingError } = await admin
    .from("inquiries")
    .select("*")
    .eq("tenant_id", userId)
    .eq("property_id", property.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("mobile create message existing:", existingError.message);
    return mobileError("Could not start conversation", "MESSAGES_ERROR", 500);
  }
  if (existingInquiry) return existingInquiry;

  const { data: inserted, error: insertError } = await admin
    .from("inquiries")
    .insert({
      tenant_id: userId,
      landlord_id: property.owner_id,
      property_id: property.id,
      message: text,
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("mobile create inquiry:", insertError.message);
    return mobileError(insertError.message, "MESSAGES_ERROR", 400);
  }
  return inserted;
}

async function handleCreateMessage(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ propertyId?: string; message?: string }>(req);
  if (body instanceof Response) return body;

  const propertyId = parseUuid(body.propertyId);
  if (!propertyId) return mobileError("propertyId required", "BAD_REQUEST", 400);

  const text = typeof body.message === "string" ? body.message.trim() : "";
  if (text.length < 3 || text.length > 1000) {
    return mobileError("message must be 3–1000 characters", "BAD_REQUEST", 400);
  }

  try {
    const plusErr = await requirePlusToMessage(auth.admin, auth.userId);
    if (plusErr) return plusErr;

    const property = await loadActiveListingForMessage(auth.admin, propertyId);
    if (property instanceof Response) return property;

    const inquiry = await loadOrCreateInquiry(auth.admin, auth.userId, property, text);
    if (inquiry instanceof Response) return inquiry;

    const { error: messageError } = await auth.admin.from("inquiry_messages").insert({
      inquiry_id: inquiry.id,
      sender_id: auth.userId,
      body: text,
    });

    if (messageError) {
      console.error("mobile create inquiry message:", messageError.message);
      return mobileError("Could not send first message", "MESSAGES_ERROR", 500);
    }

    await auth.admin
      .from("inquiries")
      .update({ updated_at: new Date().toISOString(), message: text })
      .eq("id", inquiry.id);

    return mobileJson(
      {
        apiVersion: "v1",
        inquiry: {
          ...inquiry,
          properties: { title: property.title },
        },
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start conversation";
    console.error("mobile create message:", message);
    return mobileError(message, "MESSAGES_ERROR", 500);
  }
}

// ── Property management depth ────────────────────────────────────────────────

async function withPmAccess(req: Request, propertyId: string) {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  try {
    const { asPmDb, assertPmPropertyAccess } = await import("@/lib/pm/access");
    const admin = asPmDb(auth.admin);
    await assertPmPropertyAccess(admin, auth.userId, propertyId);
    return { admin, userId: auth.userId };
  } catch (err) {
    return mapPmError(err);
  }
}

async function handlePmUnits(req: Request, propertyId: string): Promise<Response> {
  const ctx = await withPmAccess(req, propertyId);
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.admin
    .from("pm_units")
    .select("*")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .order("unit_label")
    .limit(1000);

  if (error) {
    console.error("mobile pm units:", error.message);
    return mobileError("Could not load units", "PM_ERROR", 500);
  }

  return mobileJson({ apiVersion: "v1", items: data ?? [] });
}

async function handlePmTenants(req: Request, propertyId: string): Promise<Response> {
  const ctx = await withPmAccess(req, propertyId);
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.admin
    .from("pm_tenants")
    .select("*")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .order("full_name")
    .limit(1000);

  if (error) {
    console.error("mobile pm tenants:", error.message);
    return mobileError("Could not load tenants", "PM_ERROR", 500);
  }

  return mobileJson({ apiVersion: "v1", items: data ?? [] });
}

async function handlePmMaintenance(req: Request, propertyId: string): Promise<Response> {
  const ctx = await withPmAccess(req, propertyId);
  if (ctx instanceof Response) return ctx;

  const { data: units, error: unitsError } = await ctx.admin
    .from("pm_units")
    .select("id")
    .eq("property_id", propertyId)
    .is("deleted_at", null);

  if (unitsError) {
    console.error("mobile pm maintenance units:", unitsError.message);
    return mobileError("Could not load maintenance", "PM_ERROR", 500);
  }

  const unitIds = (units ?? []).map((u: { id: string }) => u.id);
  if (unitIds.length === 0) {
    return mobileJson({ apiVersion: "v1", items: [] });
  }

  const { data, error } = await ctx.admin
    .from("pm_maintenance_requests")
    .select("*")
    .in("unit_id", unitIds)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("mobile pm maintenance:", error.message);
    return mobileError("Could not load maintenance", "PM_ERROR", 500);
  }

  return mobileJson({ apiVersion: "v1", items: data ?? [] });
}

async function handlePmPropertyDetail(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  try {
    const { asPmDb, assertPmPropertyAccess } = await import("@/lib/pm/access");
    const admin = asPmDb(auth.admin);
    const { property } = await assertPmPropertyAccess(admin, auth.userId, propertyId);

    const [unitsRes, tenantsRes] = await Promise.all([
      admin
        .from("pm_units")
        .select("id", { count: "exact", head: true })
        .eq("property_id", propertyId)
        .is("deleted_at", null),
      admin
        .from("pm_tenants")
        .select("id", { count: "exact", head: true })
        .eq("property_id", propertyId)
        .is("deleted_at", null),
    ]);

    return mobileJson({
      apiVersion: "v1",
      property,
      counts: {
        units: unitsRes.count ?? 0,
        tenants: tenantsRes.count ?? 0,
      },
    });
  } catch (err) {
    return mapPmError(err);
  }
}

/**
 * Wave 3 Mobile BFF expansions. Returns null when the path/method is not handled here.
 */
async function tryWave3MessageRoute(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const messageMatch = /^\/messages\/([^/]+)$/.exec(rest);
  if (!messageMatch) return null;
  const id = parseUuid(messageMatch[1]);
  if (!id) return mobileError("Invalid message id", "BAD_REQUEST", 400);
  if (method === "GET") return handleGetMessage(req, id);
  if (method === "POST") return handlePostMessage(req, id);
  return null;
}

async function tryWave3PmRoute(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  if (method !== "GET") return null;

  const pmNested = /^\/property-management\/properties\/([^/]+)\/(units|tenants|maintenance)$/.exec(
    rest,
  );
  if (pmNested) {
    const id = parseUuid(pmNested[1]);
    if (!id) return mobileError("Invalid property id", "BAD_REQUEST", 400);
    const kind = pmNested[2];
    if (kind === "units") return handlePmUnits(req, id);
    if (kind === "tenants") return handlePmTenants(req, id);
    return handlePmMaintenance(req, id);
  }

  const pmDetail = /^\/property-management\/properties\/([^/]+)$/.exec(rest);
  if (!pmDetail) return null;
  const id = parseUuid(pmDetail[1]);
  if (!id) return mobileError("Invalid property id", "BAD_REQUEST", 400);
  return handlePmPropertyDetail(req, id);
}

async function tryWave3ParamRoutes(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  return (
    (await tryWave3MessageRoute(req, rest, method)) ?? (await tryWave3PmRoute(req, rest, method))
  );
}

export async function tryHandleWave3(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const exact: Record<string, (r: Request) => Promise<Response>> = {
    "POST /subscriptions/checkout": handleSubscriptionsCheckout,
    "POST /properties": handleCreateProperty,
    "GET /messages": handleListMessages,
    "POST /messages": handleCreateMessage,
  };
  const exactHandler = exact[`${method} ${rest}`];
  if (exactHandler) return exactHandler(req);
  return tryWave3ParamRoutes(req, rest, method);
}
