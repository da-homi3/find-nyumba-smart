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

const PORTAL_APPLY_ROLES = ["landlord", "manager", "agency"] as const;
const DASHBOARD_ROLES = ["landlord", "agency", "manager", "admin"] as const;

async function requireAnyRole(
  admin: MobileAdmin,
  userId: string,
  roles: readonly string[],
): Promise<Response | null> {
  for (const role of roles) {
    if (await userHasRole(admin, userId, role as AppRole)) return null;
  }
  return mobileError("Portal role required", "FORBIDDEN", 403);
}

// ── Payments / billing history ───────────────────────────────────────────────

async function handleListPayments(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "40");
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.trunc(limitRaw))) : 40;

  const { data: rows, error } = await auth.admin
    .from("payments")
    .select(
      "id, amount_kes, status, payment_type, payment_method, created_at, mpesa_receipt, property_id, metadata",
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("mobile payments list:", error.message);
    return mobileError("Could not load payments", "PAYMENTS_ERROR", 500);
  }

  return mobileJson({
    apiVersion: "v1",
    items: (rows ?? []).map((row) => ({
      id: row.id,
      amountKes: row.amount_kes,
      status: row.status,
      paymentType: row.payment_type,
      paymentMethod: row.payment_method,
      createdAt: row.created_at,
      receipt: row.mpesa_receipt,
      propertyId: row.property_id,
      metadata: row.metadata ?? {},
    })),
  });
}

// ── Landlord dashboard ───────────────────────────────────────────────────────

async function handleLandlordDashboard(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const roleErr = await requireAnyRole(auth.admin, auth.userId, DASHBOARD_ROLES);
  if (roleErr) return roleErr;

  const [{ data: properties, error: propertiesError }, { data: leads, error: leadsError }] =
    await Promise.all([
      auth.admin
        .from("properties")
        .select("id, title, rent_kes, is_active, is_vacant, views, neighborhood, updated_at")
        .eq("owner_id", auth.userId)
        .limit(300),
      auth.admin
        .from("inquiries")
        .select("id, status, created_at, property_id, message")
        .eq("landlord_id", auth.userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (propertiesError) {
    console.error("mobile landlord dashboard properties:", propertiesError.message);
    return mobileError("Could not load dashboard", "DASHBOARD_ERROR", 500);
  }
  if (leadsError) {
    console.error("mobile landlord dashboard leads:", leadsError.message);
    return mobileError("Could not load dashboard", "DASHBOARD_ERROR", 500);
  }

  const propertyRows = properties ?? [];
  const leadRows = leads ?? [];
  const activeProperties = propertyRows.filter((p) => p.is_active);
  const totalViews = propertyRows.reduce((sum, p) => sum + (p.views ?? 0), 0);
  const potentialRevenue = activeProperties.reduce((sum, p) => sum + (p.rent_kes ?? 0), 0);

  return mobileJson({
    apiVersion: "v1",
    stats: {
      totalProperties: propertyRows.length,
      activeProperties: activeProperties.length,
      vacantProperties: propertyRows.filter((p) => p.is_vacant).length,
      totalViews,
      totalLeads: leadRows.length,
      newLeads: leadRows.filter((lead) => lead.status === "new").length,
      potentialRevenue,
    },
    recentLeads: leadRows.slice(0, 10),
    properties: propertyRows.slice(0, 20),
  });
}

// ── Portal applications ──────────────────────────────────────────────────────

async function handlePortalStatus(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const { data, error } = await auth.admin
    .from("portal_applications")
    .select(
      "id, requested_role, organization_name, phone, notes, status, rejection_reason, created_at, reviewed_at",
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("mobile portal status:", error.message);
    return mobileError("Could not load portal applications", "PORTAL_ERROR", 500);
  }

  return mobileJson({
    apiVersion: "v1",
    applications: data ?? [],
  });
}

type PortalApplyBody = {
  requestedRole?: string;
  organizationName?: string;
  phone?: string;
  notes?: string;
};

type ParsedPortalApply = {
  requestedRole: (typeof PORTAL_APPLY_ROLES)[number];
  phone: string;
  organizationName: string;
  notes: string | null;
};

const PORTAL_SELECT =
  "id, requested_role, organization_name, phone, notes, status, rejection_reason, created_at, reviewed_at";

function parsePortalApplyBody(body: PortalApplyBody): ParsedPortalApply | Response {
  const requestedRoleRaw = body.requestedRole;
  if (!requestedRoleRaw || !(PORTAL_APPLY_ROLES as readonly string[]).includes(requestedRoleRaw)) {
    return mobileError("requestedRole must be landlord|manager|agency", "BAD_REQUEST", 400);
  }
  const requestedRole = requestedRoleRaw as (typeof PORTAL_APPLY_ROLES)[number];

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!phone) {
    return mobileError("phone is required", "BAD_REQUEST", 400);
  }

  const organizationName =
    typeof body.organizationName === "string" ? body.organizationName.trim() : "";
  if (!organizationName) {
    return mobileError(
      requestedRole === "landlord"
        ? "Portfolio or business name is required"
        : "Organization name is required",
      "BAD_REQUEST",
      400,
    );
  }

  return {
    requestedRole,
    phone,
    organizationName,
    notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null,
  };
}

async function upsertPortalApplication(
  admin: MobileAdmin,
  userId: string,
  parsed: ParsedPortalApply,
  existingId: string | undefined,
): Promise<{ row: Record<string, unknown> } | Response> {
  const now = new Date().toISOString();

  if (existingId) {
    const { data: updated, error } = await admin
      .from("portal_applications")
      .update({
        organization_name: parsed.organizationName || null,
        phone: parsed.phone,
        notes: parsed.notes,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
        updated_at: now,
      })
      .eq("id", existingId)
      .select(PORTAL_SELECT)
      .single();
    if (error) {
      console.error("mobile portal apply update:", error.message);
      return mobileError(error.message, "PORTAL_ERROR", 400);
    }
    return { row: updated as Record<string, unknown> };
  }

  const { data: inserted, error } = await admin
    .from("portal_applications")
    .insert({
      user_id: userId,
      requested_role: parsed.requestedRole,
      organization_name: parsed.organizationName || null,
      phone: parsed.phone,
      notes: parsed.notes,
      status: "pending",
    })
    .select(PORTAL_SELECT)
    .single();
  if (error) {
    console.error("mobile portal apply insert:", error.message);
    return mobileError(error.message, "PORTAL_ERROR", 400);
  }
  return { row: inserted as Record<string, unknown> };
}

async function notifyPortalApplyOps(
  admin: MobileAdmin,
  userId: string,
  parsed: ParsedPortalApply,
): Promise<void> {
  try {
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    const email = userData.user?.email ?? "";
    const name =
      (userData.user?.user_metadata?.full_name as string | undefined) ?? email ?? "Applicant";
    const { notifyOpsNewApplication } = await import("@/lib/api/notify");
    const { getSiteUrl } = await import("@/lib/site");
    await notifyOpsNewApplication({
      applicantName: name,
      applicantEmail: email,
      role: parsed.requestedRole,
      orgName: parsed.organizationName || undefined,
      reviewUrl: `${getSiteUrl()}/admin?tab=applications`,
    });
  } catch (err) {
    console.warn(
      "mobile portal apply notify failed:",
      err instanceof Error ? err.message : "unknown",
    );
  }
}

async function handlePortalApply(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<PortalApplyBody>(req);
  if (body instanceof Response) return body;

  const parsed = parsePortalApplyBody(body);
  if (parsed instanceof Response) return parsed;

  const { data: existing } = await auth.admin
    .from("portal_applications")
    .select("id, status")
    .eq("user_id", auth.userId)
    .eq("requested_role", parsed.requestedRole)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.status === "approved") {
    return mobileJson({
      apiVersion: "v1",
      application: existing,
      alreadyApproved: true,
    });
  }

  const upserted = await upsertPortalApplication(
    auth.admin,
    auth.userId,
    parsed,
    existing?.id as string | undefined,
  );
  if (upserted instanceof Response) return upserted;

  await notifyPortalApplyOps(auth.admin, auth.userId, parsed);

  return mobileJson({ apiVersion: "v1", application: upserted.row, alreadyApproved: false }, 201);
}

// ── Verification pay ─────────────────────────────────────────────────────────

type VerificationPayBody = {
  paymentMethod?: string;
  phoneNumber?: string;
  email?: string;
  idempotencyKey?: string;
};

type VerificationRequestRow = {
  id: string;
  tier: string;
  amount_paid_kes: number | null;
  requester_email: string | null;
  requester_phone: string | null;
  requester_name: string | null;
  status: string;
};

function resolveVerificationPayInput(
  request: VerificationRequestRow,
  body: VerificationPayBody,
  requestId: string,
):
  | {
      paymentMethod: "card" | "mpesa";
      phoneNumber: string;
      email: string;
      amountKes: number;
      idempotencyKey: string;
    }
  | Response {
  const paymentMethod = body.paymentMethod === "card" ? "card" : "mpesa";
  const phoneNumber =
    typeof body.phoneNumber === "string" && body.phoneNumber.trim()
      ? body.phoneNumber.trim()
      : (request.requester_phone as string);
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : (request.requester_email as string);

  const amountKes = request.amount_paid_kes ?? 0;
  if (!amountKes || amountKes < 1) {
    return mobileError("Invalid verification amount", "BAD_REQUEST", 400);
  }

  const idempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.length >= 8
      ? body.idempotencyKey.slice(0, 64)
      : `verify-${requestId.slice(0, 8)}-${Date.now()}`;

  return { paymentMethod, phoneNumber, email, amountKes, idempotencyKey };
}

async function handleVerificationPay(req: Request, requestId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const { data: request, error } = await auth.admin
    .from("verification_requests")
    .select("id, tier, amount_paid_kes, requester_email, requester_phone, requester_name, status")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    console.error("mobile verification pay load:", error.message);
    return mobileError("Could not load verification request", "VERIFICATION_ERROR", 500);
  }
  if (!request) return mobileError("Verification request not found", "NOT_FOUND", 404);

  const body = await parseJsonBody<VerificationPayBody>(req);
  if (body instanceof Response) return body;

  const resolved = resolveVerificationPayInput(request as VerificationRequestRow, body, requestId);
  if (resolved instanceof Response) return resolved;

  try {
    const { initiatePaymentCore } = await import("@/lib/payments/initiate-payment-core");
    const result = await initiatePaymentCore(auth.userId, {
      amountKes: resolved.amountKes,
      paymentType: "verification",
      phoneNumber:
        resolved.paymentMethod === "mpesa" ? resolved.phoneNumber : resolved.phoneNumber || "",
      paymentMethod: resolved.paymentMethod,
      idempotencyKey: resolved.idempotencyKey,
      email: resolved.email,
      name: request.requester_name as string,
      verificationTier: request.tier as "basic" | "standard" | "express",
      verificationRequestId: requestId,
      title: `Property verification (${request.tier})`,
      successPath: `/verify/${requestId}`,
      cancelPath: `/verify/${requestId}`,
      plan: `verification-${request.tier}`,
    });
    return mobileJson({ apiVersion: "v1", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment failed";
    return mobileError(message, "PAYMENT_ERROR", 400);
  }
}

/**
 * Wave 9 Mobile BFF — billing, landlord dashboard, portal apply, verification pay.
 */
export async function tryHandleWave9(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const exact: Record<string, (r: Request) => Promise<Response>> = {
    "GET /payments": handleListPayments,
    "GET /landlords/dashboard": handleLandlordDashboard,
    "GET /me/portal-status": handlePortalStatus,
    "POST /me/portal-apply": handlePortalApply,
  };

  const exactHandler = exact[`${method} ${rest}`];
  if (exactHandler) return exactHandler(req);

  const verifyPay = /^\/verification\/requests\/([^/]+)\/pay$/.exec(rest);
  if (verifyPay && method === "POST") {
    const id = parseUuid(verifyPay[1]);
    if (!id) return mobileError("Invalid verification id", "BAD_REQUEST", 400);
    return handleVerificationPay(req, id);
  }

  return null;
}
