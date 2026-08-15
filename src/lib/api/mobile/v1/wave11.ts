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

const PORTAL_ROLES = ["landlord", "agency", "manager", "admin"] as const;
const DESTINATION_TYPES = ["mpesa_paybill", "mpesa_till", "mpesa_phone", "bank_account"] as const;

async function requirePortalRole(admin: MobileAdmin, userId: string): Promise<Response | null> {
  for (const role of PORTAL_ROLES) {
    if (await userHasRole(admin, userId, role as AppRole)) return null;
  }
  return mobileError("Portal role required", "FORBIDDEN", 403);
}

async function caretakerHash(value: string): Promise<string> {
  const secret =
    process.env.CARETAKER_SESSION_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "nyumba-caretaker-dev-secret");
  if (!secret) throw new Error("CARETAKER_SESSION_SECRET is not configured");
  const data = new TextEncoder().encode(`${secret}:${value}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generatePin(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = buf[0] ?? 0;
  return String(1000 + (n % 9000));
}

// ── Caretakers (landlord manage) ─────────────────────────────────────────────

async function handleListCaretakers(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const { data: caretakers, error } = await auth.admin
    .from("caretakers")
    .select("id, full_name, phone, is_active, created_at, last_login_at")
    .eq("landlord_id", auth.userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("mobile list caretakers:", error.message);
    return mobileError(error.message, "CARETAKER_ERROR", 400);
  }
  if (!caretakers?.length) {
    return mobileJson({ apiVersion: "v1", caretakers: [] });
  }

  const ids = caretakers.map((c) => c.id);
  const { data: assignments } = await auth.admin
    .from("caretaker_property_assignments")
    .select("caretaker_id, property_id")
    .in("caretaker_id", ids);

  const byCaretaker = new Map<string, string[]>();
  for (const row of assignments ?? []) {
    const list = byCaretaker.get(row.caretaker_id) ?? [];
    list.push(row.property_id);
    byCaretaker.set(row.caretaker_id, list);
  }

  return mobileJson({
    apiVersion: "v1",
    caretakers: caretakers.map((c) => ({
      id: c.id,
      fullName: c.full_name,
      phone: c.phone,
      isActive: c.is_active,
      createdAt: c.created_at,
      lastLoginAt: c.last_login_at,
      propertyIds: byCaretaker.get(c.id) ?? [],
    })),
  });
}

async function handleCreateCaretaker(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<{
    fullName?: string;
    phone?: string;
    propertyIds?: string[];
  }>(req);
  if (body instanceof Response) return body;

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const propertyIds = Array.isArray(body.propertyIds)
    ? body.propertyIds.filter(
        (id): id is string => typeof id === "string" && Boolean(parseUuid(id)),
      )
    : [];

  if (fullName.length < 2) return mobileError("fullName is required", "BAD_REQUEST", 400);
  if (phone.length < 9) return mobileError("phone is required", "BAD_REQUEST", 400);
  if (!propertyIds.length) {
    return mobileError("Select at least one property", "BAD_REQUEST", 400);
  }

  const { data: owned } = await auth.admin
    .from("properties")
    .select("id")
    .eq("owner_id", auth.userId)
    .in("id", propertyIds);
  if ((owned ?? []).length !== propertyIds.length) {
    return mobileError("One or more properties are not yours", "FORBIDDEN", 403);
  }

  try {
    const pin = generatePin();
    const pinHash = await caretakerHash(pin);
    const { data: row, error } = await auth.admin
      .from("caretakers")
      .insert({
        landlord_id: auth.userId,
        full_name: fullName,
        phone,
        pin_hash: pinHash,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw error;

    await auth.admin.from("caretaker_property_assignments").insert(
      propertyIds.map((propertyId) => ({
        caretaker_id: row.id,
        property_id: propertyId,
      })),
    );

    return mobileJson({ apiVersion: "v1", caretakerId: row.id, pin, fullName, phone }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create caretaker";
    return mobileError(message, "CARETAKER_ERROR", 400);
  }
}

async function handleRegeneratePin(req: Request, caretakerId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  try {
    const pin = generatePin();
    const pinHash = await caretakerHash(pin);
    const { data, error } = await auth.admin
      .from("caretakers")
      .update({ pin_hash: pinHash })
      .eq("id", caretakerId)
      .eq("landlord_id", auth.userId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return mobileError("Caretaker not found", "NOT_FOUND", 404);
    return mobileJson({ apiVersion: "v1", caretakerId, pin });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not regenerate PIN";
    return mobileError(message, "CARETAKER_ERROR", 400);
  }
}

async function handleRevokeCaretaker(req: Request, caretakerId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const { data, error } = await auth.admin
    .from("caretakers")
    .update({ is_active: false })
    .eq("id", caretakerId)
    .eq("landlord_id", auth.userId)
    .select("id")
    .maybeSingle();
  if (error) {
    return mobileError(error.message, "CARETAKER_ERROR", 400);
  }
  if (!data) return mobileError("Caretaker not found", "NOT_FOUND", 404);
  return mobileJson({ apiVersion: "v1", ok: true, caretakerId });
}

// ── Payout destinations ──────────────────────────────────────────────────────

async function handleListPayouts(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  try {
    const { asPmDb } = await import("@/lib/pm/access");
    const admin = asPmDb(auth.admin);
    const { data, error } = await admin
      .from("pm_payout_destinations")
      .select("*")
      .eq("owner_user_id", auth.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return mobileJson({ apiVersion: "v1", destinations: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not list payouts";
    return mobileError(message, "PAYOUT_ERROR", 400);
  }
}

async function handleListPayoutBatches(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  try {
    const { asPmDb } = await import("@/lib/pm/access");
    const admin = asPmDb(auth.admin);
    const { data, error } = await admin
      .from("pm_payout_batches")
      .select("*")
      .eq("owner_user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return mobileJson({ apiVersion: "v1", batches: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not list batches";
    return mobileError(message, "PAYOUT_ERROR", 400);
  }
}

type PayoutCreateBody = {
  destinationType?: string;
  propertyId?: string | null;
  mpesaPaybillNumber?: string | null;
  mpesaAccountNumber?: string | null;
  mpesaTillNumber?: string | null;
  mpesaPhone?: string | null;
  bankName?: string | null;
  bankCode?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  otpVerified?: boolean;
};

type DestinationValidation = {
  verified: boolean;
  phone254: string | null;
  warning?: string;
  resolvedName?: string;
};

type DestinationValidationResult = DestinationValidation | Response;

function validateMpesaPhoneDestination(
  body: PayoutCreateBody,
  toMpesaPhone254: (phone: string) => string | null,
): DestinationValidationResult {
  const phone254 = toMpesaPhone254(typeof body.mpesaPhone === "string" ? body.mpesaPhone : "");
  if (!phone254) {
    return mobileError("Enter a valid Safaricom phone number", "BAD_REQUEST", 400);
  }
  if (body.otpVerified !== true) {
    return mobileError(
      "Confirm the OTP sent for this M-Pesa number before saving",
      "BAD_REQUEST",
      400,
    );
  }
  return { verified: true, phone254 };
}

function validateMpesaTillDestination(body: PayoutCreateBody): DestinationValidationResult {
  if (!body.mpesaTillNumber?.trim()) {
    return mobileError("Till number is required", "BAD_REQUEST", 400);
  }
  return { verified: true, phone254: null };
}

function validateMpesaPaybillDestination(body: PayoutCreateBody): DestinationValidationResult {
  if (!body.mpesaPaybillNumber?.trim() || !body.mpesaAccountNumber?.trim()) {
    return mobileError("Paybill number and account number are required", "BAD_REQUEST", 400);
  }
  return { verified: true, phone254: null };
}

async function validateBankDestination(
  body: PayoutCreateBody,
): Promise<DestinationValidationResult> {
  if (!body.bankCode?.trim() || !body.bankAccountNumber?.trim() || !body.bankAccountName?.trim()) {
    return mobileError(
      "Bank code, account number, and account name are required",
      "BAD_REQUEST",
      400,
    );
  }
  const { resolveBankAccountName } = await import("@/lib/pm/intasend-payout");
  const { namesRoughlyMatch } = await import("@/lib/pm/payout-destinations");
  const resolved = await resolveBankAccountName({
    accountNumber: body.bankAccountNumber.trim(),
    bankCode: body.bankCode.trim(),
  });
  if (!resolved.ok) {
    return { verified: false, phone254: null, warning: resolved.message };
  }
  const verified = namesRoughlyMatch(resolved.accountName, body.bankAccountName.trim());
  return {
    verified,
    phone254: null,
    resolvedName: resolved.accountName,
    warning: verified
      ? undefined
      : `Bank records show "${resolved.accountName}" — that does not match what you typed. Destination saved but not verified.`,
  };
}

async function validatePayoutDestination(
  destinationType: string,
  body: PayoutCreateBody,
  toMpesaPhone254: (phone: string) => string | null,
): Promise<DestinationValidationResult> {
  if (destinationType === "mpesa_phone") {
    return validateMpesaPhoneDestination(body, toMpesaPhone254);
  }
  if (destinationType === "mpesa_till") {
    return validateMpesaTillDestination(body);
  }
  if (destinationType === "mpesa_paybill") {
    return validateMpesaPaybillDestination(body);
  }
  return validateBankDestination(body);
}

function parseDestinationType(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!(DESTINATION_TYPES as readonly string[]).includes(raw)) return null;
  return raw;
}

function optionalTrim(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function buildPayoutInsertRow(
  userId: string,
  propertyId: string | null,
  destinationType: string,
  body: PayoutCreateBody,
  validation: DestinationValidation,
) {
  return {
    owner_user_id: userId,
    property_id: propertyId,
    destination_type: destinationType,
    mpesa_paybill_number: optionalTrim(body.mpesaPaybillNumber),
    mpesa_account_number: optionalTrim(body.mpesaAccountNumber),
    mpesa_till_number: optionalTrim(body.mpesaTillNumber),
    mpesa_phone: validation.phone254,
    bank_name: optionalTrim(body.bankName),
    bank_code: optionalTrim(body.bankCode),
    bank_account_number: optionalTrim(body.bankAccountNumber),
    bank_account_name: optionalTrim(body.bankAccountName),
    verified: validation.verified,
    is_active: true,
  };
}

async function handleCreatePayout(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<PayoutCreateBody>(req);
  if (body instanceof Response) return body;

  const destinationType = parseDestinationType(body.destinationType);
  if (!destinationType) {
    return mobileError(
      "destinationType must be mpesa_paybill|mpesa_till|mpesa_phone|bank_account",
      "BAD_REQUEST",
      400,
    );
  }

  try {
    const { asPmDb, assertPmPropertyAccess } = await import("@/lib/pm/access");
    const { toMpesaPhone254 } = await import("@/lib/phone");
    const admin = asPmDb(auth.admin);

    const propertyId =
      typeof body.propertyId === "string" && parseUuid(body.propertyId) ? body.propertyId : null;
    if (propertyId) {
      await assertPmPropertyAccess(admin, auth.userId, propertyId);
    }

    const validation = await validatePayoutDestination(destinationType, body, toMpesaPhone254);
    if (validation instanceof Response) return validation;

    const { data: row, error } = await admin
      .from("pm_payout_destinations")
      .insert(buildPayoutInsertRow(auth.userId, propertyId, destinationType, body, validation))
      .select("*")
      .single();
    if (error) throw error;

    return mobileJson(
      {
        apiVersion: "v1",
        destination: row,
        verified: validation.verified,
        resolvedName: validation.resolvedName,
        warning: validation.warning,
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save destination";
    return mobileError(message, "PAYOUT_ERROR", 400);
  }
}

async function handleDeactivatePayout(req: Request, destinationId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  try {
    const { asPmDb } = await import("@/lib/pm/access");
    const admin = asPmDb(auth.admin);
    const { data, error } = await admin
      .from("pm_payout_destinations")
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq("id", destinationId)
      .eq("owner_user_id", auth.userId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return mobileError("Destination not found", "NOT_FOUND", 404);
    return mobileJson({ apiVersion: "v1", ok: true, destinationId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not deactivate";
    return mobileError(message, "PAYOUT_ERROR", 400);
  }
}

async function handlePayoutOtpRequest(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<{ phone?: string }>(req);
  if (body instanceof Response) return body;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  try {
    const { toMpesaPhone254 } = await import("@/lib/phone");
    const phone254 = toMpesaPhone254(phone);
    if (!phone254) return mobileError("Invalid Safaricom phone number", "BAD_REQUEST", 400);

    const { storePayoutPhoneOtp } = await import("@/lib/pm/payout-otp-store");
    const code = await storePayoutPhoneOtp({ userId: auth.userId, phone: phone254 });

    const { sendEmail } = await import("@/lib/email/send");
    const email = auth.user.email;
    if (email) {
      await sendEmail({
        to: email,
        templateId: "payout_phone_otp",
        subject: "Confirm your rent payout M-Pesa number",
        text: `Your NyumbaSearch payout confirmation code is ${code}. It expires in 15 minutes.\n\nNumber: ${phone254}`,
        html: `<p>Your confirmation code for M-Pesa payout number <strong>${phone254}</strong> is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>Expires in 15 minutes.</p>`,
      });
    }

    return mobileJson({ apiVersion: "v1", sent: true, phone: phone254 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send OTP";
    return mobileError(message, "PAYOUT_ERROR", 400);
  }
}

async function handlePayoutOtpConfirm(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<{ phone?: string; code?: string }>(req);
  if (body instanceof Response) return body;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  try {
    const { toMpesaPhone254 } = await import("@/lib/phone");
    const phone254 = toMpesaPhone254(phone);
    if (!phone254) return mobileError("Invalid phone", "BAD_REQUEST", 400);
    const { verifyPayoutPhoneOtp } = await import("@/lib/pm/payout-otp-store");
    const ok = await verifyPayoutPhoneOtp({ userId: auth.userId, phone: phone254, code });
    if (!ok) return mobileError("Invalid or expired code", "OTP_INVALID", 400);
    return mobileJson({ apiVersion: "v1", verified: true, phone: phone254 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not verify OTP";
    return mobileError(message, "PAYOUT_ERROR", 400);
  }
}

/**
 * Wave 11 Mobile BFF — landlord caretakers + payout destinations.
 */
export async function tryHandleWave11(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const exact: Record<string, (r: Request) => Promise<Response>> = {
    "GET /caretakers": handleListCaretakers,
    "POST /caretakers": handleCreateCaretaker,
    "GET /landlords/payouts": handleListPayouts,
    "POST /landlords/payouts": handleCreatePayout,
    "GET /landlords/payouts/batches": handleListPayoutBatches,
    "POST /landlords/payouts/otp/request": handlePayoutOtpRequest,
    "POST /landlords/payouts/otp/confirm": handlePayoutOtpConfirm,
  };

  const exactKey = `${method} ${rest}`;
  const exactHandler = exact[exactKey];
  if (exactHandler) return exactHandler(req);

  const pinMatch = /^\/caretakers\/([^/]+)\/regenerate-pin$/.exec(rest);
  if (pinMatch && method === "POST") {
    const id = parseUuid(pinMatch[1]);
    if (!id) return mobileError("Invalid caretaker id", "BAD_REQUEST", 400);
    return handleRegeneratePin(req, id);
  }

  const revokeMatch = /^\/caretakers\/([^/]+)\/revoke$/.exec(rest);
  if (revokeMatch && method === "POST") {
    const id = parseUuid(revokeMatch[1]);
    if (!id) return mobileError("Invalid caretaker id", "BAD_REQUEST", 400);
    return handleRevokeCaretaker(req, id);
  }

  const deactivate = /^\/landlords\/payouts\/([^/]+)\/deactivate$/.exec(rest);
  if (deactivate && method === "POST") {
    const id = parseUuid(deactivate[1]);
    if (!id) return mobileError("Invalid destination id", "BAD_REQUEST", 400);
    return handleDeactivatePayout(req, id);
  }

  return null;
}
