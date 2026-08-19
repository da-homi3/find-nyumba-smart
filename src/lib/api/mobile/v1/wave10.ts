import type { Database } from "@/integrations/supabase/types";
import {
  mobileError,
  mobileJson,
  requireMobileBearer,
  userHasRole,
  type MobileAdmin,
} from "@/lib/api/mobile/v1/auth";
import { parseJsonBody, parseUuid } from "@/lib/api/mobile/v1/helpers";

type AppRole = Database["public"]["Enums"]["app_role"];

const PM_PROPERTY_TYPES = [
  "apartment_block",
  "estate",
  "single_unit",
  "commercial",
  "mixed_use",
] as const;

const PORTAL_ROLES = ["landlord", "agency", "manager", "admin"] as const;

async function requirePortalRole(admin: MobileAdmin, userId: string): Promise<Response | null> {
  for (const role of PORTAL_ROLES) {
    if (await userHasRole(admin, userId, role as AppRole)) return null;
  }
  return mobileError("Portal role required", "FORBIDDEN", 403);
}

function caretakerTokenFrom(req: Request, bodyToken?: unknown): string | null {
  const header = req.headers.get("X-Caretaker-Token")?.trim();
  if (header && header.length >= 16) return header;
  if (typeof bodyToken === "string" && bodyToken.trim().length >= 16) return bodyToken.trim();
  const url = new URL(req.url);
  const q = url.searchParams.get("token")?.trim();
  if (q && q.length >= 16) return q;
  return null;
}

async function resolveCaretaker(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const secret =
    process.env.CARETAKER_SESSION_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "nyumba-caretaker-dev-secret");
  if (!secret) throw new Error("CARETAKER_SESSION_SECRET is not configured");

  const data = new TextEncoder().encode(`${secret}:${token}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const tokenHash = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: session } = await supabaseAdmin
    .from("caretaker_sessions")
    .select("caretaker_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!session) throw new Error("Invalid caretaker session");
  if (new Date(session.expires_at) < new Date()) throw new Error("Caretaker session expired");

  const { data: caretaker } = await supabaseAdmin
    .from("caretakers")
    .select("*")
    .eq("id", session.caretaker_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!caretaker) throw new Error("Caretaker not found");
  return caretaker;
}

// ── Create managed property ──────────────────────────────────────────────────

type PmPropertyBody = {
  name?: string;
  propertyType?: string;
  address?: string;
  neighborhood?: string;
  lat?: number | null;
  lng?: number | null;
  photoUrl?: string | null;
};

type ParsedPmProperty = {
  name: string;
  address: string;
  neighborhood: string;
  propertyType: string;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
};

function parsePmPropertyInput(body: PmPropertyBody): ParsedPmProperty | Response {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const neighborhood = typeof body.neighborhood === "string" ? body.neighborhood.trim() : "";
  const propertyType =
    typeof body.propertyType === "string" ? body.propertyType.trim() : "apartment_block";

  if (!name) return mobileError("name is required", "BAD_REQUEST", 400);
  if (!address) return mobileError("address is required", "BAD_REQUEST", 400);
  if (!neighborhood) return mobileError("neighborhood is required", "BAD_REQUEST", 400);
  if (!(PM_PROPERTY_TYPES as readonly string[]).includes(propertyType)) {
    return mobileError("Invalid propertyType", "BAD_REQUEST", 400);
  }

  return {
    name,
    address,
    neighborhood,
    propertyType,
    lat: typeof body.lat === "number" ? body.lat : null,
    lng: typeof body.lng === "number" ? body.lng : null,
    photoUrl:
      typeof body.photoUrl === "string" && body.photoUrl.trim() ? body.photoUrl.trim() : null,
  };
}

async function insertPmProperty(
  admin: MobileAdmin,
  userId: string,
  input: ParsedPmProperty,
): Promise<Response> {
  const { asPmDb } = await import("@/lib/pm/access");
  const { requirePmModuleSubscription } = await import("@/lib/pm/module-gate");
  const { getUserOrganizationId } = await import("@/lib/api/nyumba/nyumba-shared");
  const pmAdmin = asPmDb(admin);
  await requirePmModuleSubscription(pmAdmin, userId);
  const orgId = await getUserOrganizationId(admin, userId);

  const { data: row, error } = await pmAdmin
    .from("pm_properties")
    .insert({
      owner_user_id: userId,
      agency_id: orgId,
      name: input.name,
      property_type: input.propertyType,
      address: input.address,
      neighborhood: input.neighborhood,
      lat: input.lat,
      lng: input.lng,
      photo_url: input.photoUrl,
      status: "active",
      pm_module_active: true,
    })
    .select("*")
    .single();

  if (error) {
    console.error("mobile create pm property:", error.message);
    return mobileError(error.message, "PM_ERROR", 400);
  }

  await pmAdmin
    .from("pm_property_staff")
    .upsert(
      { property_id: row.id, user_id: userId, role: "owner" },
      { onConflict: "property_id,user_id" },
    );

  return mobileJson({ apiVersion: "v1", property: row }, 201);
}

async function handleCreatePmProperty(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<PmPropertyBody>(req);
  if (body instanceof Response) return body;

  const parsed = parsePmPropertyInput(body);
  if (parsed instanceof Response) return parsed;

  try {
    return await insertPmProperty(auth.admin, auth.userId, parsed);
  } catch (err) {
    const { PmModuleRequiredError } = await import("@/lib/pm/module-gate");
    if (err instanceof PmModuleRequiredError) {
      return mobileError(err.message, err.code, err.status);
    }
    const message = err instanceof Error ? err.message : "Could not create property";
    return mobileError(message, "PM_ERROR", 400);
  }
}

// ── PM module subscribe ──────────────────────────────────────────────────────

async function handlePmModuleSubscribe(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  try {
    const { asPmDb } = await import("@/lib/pm/access");
    const { getActivePmSubscription, hasPaidMarketplacePortalAccess } =
      await import("@/lib/pm/module-gate");
    const { recommendedPmTier } = await import("@/lib/pm/pricing");
    const admin = asPmDb(auth.admin);

    const existing = await getActivePmSubscription(admin, auth.userId);
    if (existing) {
      return mobileJson({
        apiVersion: "v1",
        status: "already_active",
        tier: existing.plan,
        priceKes: existing.amount_kes,
      });
    }

    if (await hasPaidMarketplacePortalAccess(admin, auth.userId)) {
      const { tier } = await recommendedPmTier(admin, auth.userId);
      return mobileJson({
        apiVersion: "v1",
        status: "included_with_plan",
        tier,
        priceKes: 0,
      });
    }

    // Free bonus month is granted only after the first paid period (see fulfillPmModule).
    const { tier, priceKes } = await recommendedPmTier(admin, auth.userId);

    return mobileJson({
      apiVersion: "v1",
      status: "requires_payment",
      tier,
      priceKes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not subscribe";
    console.error("mobile pm subscribe:", message);
    return mobileError(message, "PM_ERROR", 400);
  }
}

// ── Caretaker dashboard ──────────────────────────────────────────────────────

async function handleCaretakerDashboard(req: Request): Promise<Response> {
  const token = caretakerTokenFrom(req);
  if (!token) return mobileError("Caretaker token required", "UNAUTHORIZED", 401);

  try {
    const caretaker = await resolveCaretaker(token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assignments } = await supabaseAdmin
      .from("caretaker_property_assignments")
      .select("property_id")
      .eq("caretaker_id", caretaker.id);
    const propertyIds = (assignments ?? []).map((a) => a.property_id);
    if (!propertyIds.length) {
      return mobileJson({
        apiVersion: "v1",
        caretakerName: caretaker.full_name,
        properties: [],
      });
    }

    const { data: properties } = await supabaseAdmin
      .from("properties")
      .select("id, title, neighborhood, is_vacant, is_active, rent_kes, property_type")
      .in("id", propertyIds);

    return mobileJson({
      apiVersion: "v1",
      caretakerName: caretaker.full_name,
      properties: properties ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Caretaker dashboard failed";
    const status =
      message.includes("expired") || message.includes("Invalid") || message.includes("not found")
        ? 401
        : 400;
    return mobileError(message, status === 401 ? "UNAUTHORIZED" : "CARETAKER_ERROR", status);
  }
}

async function handleCaretakerVacancy(req: Request, propertyId: string): Promise<Response> {
  const body = await parseJsonBody<{ token?: string; isVacant?: boolean }>(req);
  if (body instanceof Response) return body;

  const token = caretakerTokenFrom(req, body.token);
  if (!token) return mobileError("Caretaker token required", "UNAUTHORIZED", 401);
  if (typeof body.isVacant !== "boolean") {
    return mobileError("isVacant must be a boolean", "BAD_REQUEST", 400);
  }

  try {
    const caretaker = await resolveCaretaker(token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assignment } = await supabaseAdmin
      .from("caretaker_property_assignments")
      .select("id")
      .eq("caretaker_id", caretaker.id)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!assignment) return mobileError("Property not assigned to you", "FORBIDDEN", 403);

    const { error } = await supabaseAdmin
      .from("properties")
      .update({ is_vacant: body.isVacant })
      .eq("id", propertyId)
      .eq("owner_id", caretaker.landlord_id);
    if (error) throw error;

    return mobileJson({ apiVersion: "v1", ok: true, propertyId, isVacant: body.isVacant });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update vacancy";
    return mobileError(message, "CARETAKER_ERROR", 400);
  }
}

// ── Phone signup OTP ─────────────────────────────────────────────────────────

async function handleOtpRequest(req: Request): Promise<Response> {
  const body = await parseJsonBody<{ phone?: string }>(req);
  if (body instanceof Response) return body;

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  try {
    const { isKenyanPhone, toWhatsAppDigits } = await import("@/lib/phone");
    if (!isKenyanPhone(phone)) {
      return mobileError("Enter a valid Kenyan mobile number (07XX XXX XXX)", "BAD_REQUEST", 400);
    }

    const { assertCleanKenyanMobile } = await import("@/lib/apilayer/verify");
    await assertCleanKenyanMobile(phone, "signup");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const digits254 = toWhatsAppDigits(phone)!;
    const local = phone.replace(/\D/g, "").replace(/^254/, "0");
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("phone", [local, digits254, `+${digits254}`, phone])
      .limit(1);
    if (existing?.length) {
      return mobileError(
        "An account with this phone already exists. Try signing in with email.",
        "CONFLICT",
        409,
      );
    }

    const { generateSixDigitPhoneOtp, storePhoneSignupOtp } =
      await import("@/lib/auth/phone-signup-otp-store");
    const code = generateSixDigitPhoneOtp();
    const stored = await storePhoneSignupOtp({ phone, code });
    if (stored.resentTooSoon) {
      const secs = Math.ceil((stored.retryAfterMs ?? 45_000) / 1000);
      return mobileError(`Wait ${secs}s before requesting another code.`, "RATE_LIMITED", 429);
    }

    const { phoneSignupOtpMessage, sendSmsViaAfricasTalking } =
      await import("@/lib/sms/africas-talking");
    await sendSmsViaAfricasTalking({
      to: digits254,
      message: phoneSignupOtpMessage(code),
    });

    return mobileJson({ apiVersion: "v1", ok: true, phone: digits254 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send OTP";
    return mobileError(message, "OTP_ERROR", 400);
  }
}

async function handleOtpVerify(req: Request): Promise<Response> {
  const body = await parseJsonBody<{ phone?: string; code?: string }>(req);
  if (body instanceof Response) return body;

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!phone || !code) return mobileError("phone and code required", "BAD_REQUEST", 400);

  try {
    const {
      readPhoneSignupOtp,
      phoneOtpCodesMatch,
      markPhoneSignupOtpVerified,
      bumpPhoneSignupOtpAttempt,
    } = await import("@/lib/auth/phone-signup-otp-store");

    const record = await readPhoneSignupOtp(phone);
    if (!record) {
      return mobileError("Invalid or expired code. Request a new code.", "OTP_INVALID", 400);
    }
    if (record.attempts >= 8) {
      return mobileError("Too many attempts. Request a new code.", "OTP_LOCKED", 400);
    }
    if (!phoneOtpCodesMatch(record.code, code)) {
      await bumpPhoneSignupOtpAttempt(phone);
      return mobileError("Invalid or expired code. Request a new code.", "OTP_INVALID", 400);
    }
    await markPhoneSignupOtpVerified(phone);
    return mobileJson({ apiVersion: "v1", ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not verify OTP";
    return mobileError(message, "OTP_ERROR", 400);
  }
}

/**
 * Wave 10 Mobile BFF — PM create/subscribe, caretaker dashboard, phone OTP.
 */
export async function tryHandleWave10(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  if (rest === "/property-management/properties" && method === "POST") {
    return handleCreatePmProperty(req);
  }

  if (rest === "/subscriptions/pm-module" && method === "POST") {
    return handlePmModuleSubscribe(req);
  }

  if (rest === "/caretakers/dashboard" && method === "GET") {
    return handleCaretakerDashboard(req);
  }

  const vacancy = /^\/caretakers\/properties\/([^/]+)\/vacancy$/.exec(rest);
  if (vacancy && method === "PATCH") {
    const id = parseUuid(vacancy[1]);
    if (!id) return mobileError("Invalid property id", "BAD_REQUEST", 400);
    return handleCaretakerVacancy(req, id);
  }

  if (rest === "/auth/otp/request" && method === "POST") {
    return handleOtpRequest(req);
  }

  if (rest === "/auth/otp/verify" && method === "POST") {
    return handleOtpVerify(req);
  }

  return null;
}
