import { parseUuid, parseJsonBody, mapPmError } from "@/lib/api/mobile/v1/helpers";
import type { Database } from "@/integrations/supabase/types";
import {
  mobileError,
  mobileJson,
  requireMobileBearer,
  userHasRole,
} from "@/lib/api/mobile/v1/auth";
import { asPmDb, assertPmPropertyAccess, assertStaffCan } from "@/lib/pm/access";
import { isKenyanPhone } from "@/lib/phone";

type AppRole = Database["public"]["Enums"]["app_role"];

const UNIT_TYPES = ["bedsitter", "1br", "2br", "3br", "4br+", "commercial", "other"] as const;
const VERIFY_TIERS = ["basic", "standard", "express"] as const;
const TIER_PRICES = { basic: 1000, standard: 2500, express: 5000 } as const;

async function withPmWriteAccess(req: Request, propertyId: string, permission: string) {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  try {
    const admin = asPmDb(auth.admin);
    const { staffRole } = await assertPmPropertyAccess(admin, auth.userId, propertyId);
    assertStaffCan(staffRole, permission);
    return { admin, userId: auth.userId, staffRole };
  } catch (err) {
    return mapPmError(err);
  }
}

// ── PM create unit ───────────────────────────────────────────────────────────

async function handleCreatePmUnit(req: Request, propertyId: string): Promise<Response> {
  const ctx = await withPmWriteAccess(req, propertyId, "units:create");
  if (ctx instanceof Response) return ctx;

  const body = await parseJsonBody<{
    unitLabel?: string;
    floor?: number | null;
    unitType?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    monthlyRent?: number;
    depositAmount?: number;
    buildingId?: string | null;
  }>(req);
  if (body instanceof Response) return body;

  const unitLabel = typeof body.unitLabel === "string" ? body.unitLabel.trim() : "";
  if (!unitLabel || unitLabel.length > 80) {
    return mobileError("unitLabel required (1–80 chars)", "BAD_REQUEST", 400);
  }

  const monthlyRent = body.monthlyRent;
  if (typeof monthlyRent !== "number" || !Number.isFinite(monthlyRent) || monthlyRent < 0) {
    return mobileError("monthlyRent must be a non-negative number", "BAD_REQUEST", 400);
  }

  const unitType = body.unitType ?? null;
  if (unitType != null && !(UNIT_TYPES as readonly string[]).includes(unitType)) {
    return mobileError(`unitType must be one of: ${UNIT_TYPES.join(", ")}`, "BAD_REQUEST", 400);
  }

  const { data: row, error } = await ctx.admin
    .from("pm_units")
    .insert({
      property_id: propertyId,
      building_id: body.buildingId ?? null,
      unit_label: unitLabel,
      floor: typeof body.floor === "number" ? Math.trunc(body.floor) : null,
      unit_type: unitType,
      bedrooms: typeof body.bedrooms === "number" ? Math.trunc(body.bedrooms) : null,
      bathrooms: typeof body.bathrooms === "number" ? Math.trunc(body.bathrooms) : null,
      monthly_rent: Math.trunc(monthlyRent),
      deposit_amount: typeof body.depositAmount === "number" ? Math.trunc(body.depositAmount) : 0,
      amenities: [],
      status: "vacant",
    })
    .select("*")
    .single();

  if (error) {
    console.error("mobile create unit:", error.message);
    return mobileError(error.message, "PM_ERROR", 400);
  }

  return mobileJson({ apiVersion: "v1", unit: row }, 201);
}

// ── PM create tenant ─────────────────────────────────────────────────────────

async function handleCreatePmTenant(req: Request, propertyId: string): Promise<Response> {
  const ctx = await withPmWriteAccess(req, propertyId, "tenants:create");
  if (ctx instanceof Response) return ctx;

  const body = await parseJsonBody<{
    fullName?: string;
    phone?: string;
    email?: string | null;
    nationalId?: string | null;
    notes?: string | null;
  }>(req);
  if (body instanceof Response) return body;

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (!fullName || fullName.length > 200) {
    return mobileError("fullName required (1–200 chars)", "BAD_REQUEST", 400);
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!phone || phone.length < 5 || phone.length > 40) {
    return mobileError("phone required (5–40 chars)", "BAD_REQUEST", 400);
  }

  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;

  const { data: row, error } = await ctx.admin
    .from("pm_tenants")
    .insert({
      property_id: propertyId,
      full_name: fullName,
      phone,
      email,
      national_id:
        typeof body.nationalId === "string" && body.nationalId.trim()
          ? body.nationalId.trim()
          : null,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      custom_fields: JSON.stringify([]),
      portal_status: "not_invited",
    })
    .select("*")
    .single();

  if (error) {
    console.error("mobile create tenant:", error.message);
    return mobileError(error.message, "PM_ERROR", 400);
  }

  return mobileJson({ apiVersion: "v1", tenant: row }, 201);
}

// ── Verification ─────────────────────────────────────────────────────────────

async function handleCreateVerification(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{
    propertyAddress?: string;
    listingUrl?: string;
    tier?: string;
    requesterName?: string;
    requesterPhone?: string;
    requesterEmail?: string;
  }>(req);
  if (body instanceof Response) return body;

  const propertyAddress =
    typeof body.propertyAddress === "string" ? body.propertyAddress.trim() : "";
  if (propertyAddress.length < 3) {
    return mobileError("propertyAddress required", "BAD_REQUEST", 400);
  }

  const tier = body.tier ?? "standard";
  if (!(VERIFY_TIERS as readonly string[]).includes(tier)) {
    return mobileError("tier must be basic|standard|express", "BAD_REQUEST", 400);
  }

  const requesterName = typeof body.requesterName === "string" ? body.requesterName.trim() : "";
  if (requesterName.length < 2) {
    return mobileError("requesterName required", "BAD_REQUEST", 400);
  }

  const requesterPhone = typeof body.requesterPhone === "string" ? body.requesterPhone.trim() : "";
  if (!isKenyanPhone(requesterPhone)) {
    return mobileError("Valid Kenyan phone required", "BAD_REQUEST", 400);
  }

  const requesterEmail = typeof body.requesterEmail === "string" ? body.requesterEmail.trim() : "";
  if (!requesterEmail.includes("@")) {
    return mobileError("requesterEmail required", "BAD_REQUEST", 400);
  }

  const listingUrl =
    typeof body.listingUrl === "string" && body.listingUrl.trim() ? body.listingUrl.trim() : null;

  const { data: row, error } = await auth.admin
    .from("verification_requests")
    .insert({
      property_address: propertyAddress,
      listing_url: listingUrl,
      requester_name: requesterName,
      requester_phone: requesterPhone,
      requester_email: requesterEmail,
      tier,
      amount_paid_kes: TIER_PRICES[tier as keyof typeof TIER_PRICES],
      status: "pending",
    })
    .select("id, status, tier, amount_paid_kes, property_address, created_at")
    .single();

  if (error) {
    console.error("mobile create verification:", error.message);
    return mobileError(error.message, "VERIFICATION_ERROR", 400);
  }

  return mobileJson({ apiVersion: "v1", request: row }, 201);
}

async function handleGetVerification(req: Request, requestId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const { data: row, error } = await auth.admin
    .from("verification_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    console.error("mobile get verification:", error.message);
    return mobileError("Could not load verification request", "VERIFICATION_ERROR", 500);
  }
  if (!row) return mobileError("Verification request not found", "NOT_FOUND", 404);

  const email = (auth.user.email ?? "").toLowerCase();
  const isAdmin = await userHasRole(auth.admin, auth.userId, "admin" as AppRole);
  if (!isAdmin && row.requester_email.toLowerCase() !== email) {
    return mobileError("You do not have access to this verification request", "FORBIDDEN", 403);
  }

  return mobileJson({ apiVersion: "v1", request: row });
}

/**
 * Wave 5 Mobile BFF — PM unit/tenant create + verification requests.
 */
export async function tryHandleWave5(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const pmWrite = /^\/property-management\/properties\/([^/]+)\/(units|tenants)$/.exec(rest);
  if (pmWrite && method === "POST") {
    const id = parseUuid(pmWrite[1]);
    if (!id) return mobileError("Invalid property id", "BAD_REQUEST", 400);
    if (pmWrite[2] === "units") return handleCreatePmUnit(req, id);
    if (pmWrite[2] === "tenants") return handleCreatePmTenant(req, id);
  }

  if (rest === "/verification/requests" && method === "POST") {
    return handleCreateVerification(req);
  }

  const verifyMatch = /^\/verification\/requests\/([^/]+)$/.exec(rest);
  if (verifyMatch && method === "GET") {
    const id = parseUuid(verifyMatch[1]);
    if (!id) return mobileError("Invalid request id", "BAD_REQUEST", 400);
    return handleGetVerification(req, id);
  }

  return null;
}
