import { mobileError, mobileJson, requireMobileBearer } from "@/lib/api/mobile/v1/auth";
import { parseJsonBody, parseUuid, requireAdmin } from "@/lib/api/mobile/v1/helpers";

type PortalListerRole = "landlord" | "manager" | "agency";

// ── Admin: portal applications ───────────────────────────────────────────────

async function handleListPortalApplications(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const { data: apps, error } = await auth.admin
    .from("portal_applications")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    return mobileError(error.message, "ADMIN_ERROR", 400);
  }
  if (!apps?.length) {
    return mobileJson({ apiVersion: "v1", applications: [] });
  }

  const userIds = [...new Set(apps.map((a) => a.user_id))];
  const { data: profiles } = await auth.admin
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return mobileJson({
    apiVersion: "v1",
    applications: apps.map((app) => ({
      id: app.id,
      userId: app.user_id,
      requestedRole: app.requested_role,
      organizationName: app.organization_name,
      phone: app.phone,
      notes: app.notes,
      status: app.status,
      createdAt: app.created_at,
      profile: profileMap.get(app.user_id) ?? null,
    })),
  });
}

async function handleReviewPortalApplication(
  req: Request,
  applicationId: string,
): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ action?: string; rejectionReason?: string }>(req);
  if (body instanceof Response) return body;
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return mobileError("action must be approve|reject", "BAD_REQUEST", 400);
  }

  try {
    const { data: app, error: fetchErr } = await auth.admin
      .from("portal_applications")
      .select("*")
      .eq("id", applicationId)
      .single();
    if (fetchErr || !app) return mobileError("Application not found", "NOT_FOUND", 404);

    const { data: userData } = await auth.admin.auth.admin.getUserById(app.user_id);
    const email = userData.user?.email ?? "";
    const name = (userData.user?.user_metadata?.full_name as string | undefined) ?? email;

    const { notifyApplicantApproved, notifyApplicantRejected } = await import("@/lib/api/notify");

    if (action === "reject") {
      await auth.admin
        .from("portal_applications")
        .update({
          status: "rejected",
          reviewed_by: auth.userId,
          reviewed_at: new Date().toISOString(),
          rejection_reason:
            typeof body.rejectionReason === "string" && body.rejectionReason.trim()
              ? body.rejectionReason.trim()
              : "Not approved at this time",
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId);

      await notifyApplicantRejected({
        email,
        name,
        role: app.requested_role,
        reason: body.rejectionReason,
        userId: app.user_id,
      });
      return mobileJson({ apiVersion: "v1", status: "rejected" });
    }

    await auth.admin
      .from("portal_applications")
      .update({
        status: "approved",
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    const { grantPortalListerAccess } = await import("@/lib/api/portal-approval");
    const result = await grantPortalListerAccess(auth.admin, {
      userId: app.user_id,
      requestedRole: app.requested_role as PortalListerRole,
      organizationName: app.organization_name,
      startTrial: false,
      applicationPhone: app.phone,
      reviewedByUserId: auth.userId,
    });

    await notifyApplicantApproved({
      email,
      name,
      role: app.requested_role,
      userId: app.user_id,
    });

    return mobileJson({ apiVersion: "v1", status: "approved", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review failed";
    console.error("mobile review portal application:", message);
    return mobileError(message, "ADMIN_ERROR", 400);
  }
}

// ── Admin: pending service providers ─────────────────────────────────────────

async function handleListPendingProviders(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const { data: rows, error } = await auth.admin
    .from("service_providers")
    .select(
      "id, user_id, business_name, categories, areas_served, description, price_range, phone, tier, status, created_at",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) return mobileError(error.message, "ADMIN_ERROR", 400);
  if (!rows?.length) return mobileJson({ apiVersion: "v1", providers: [] });

  const userIds = [
    ...new Set(rows.map((r) => r.user_id).filter((id): id is string => id !== null)),
  ];
  const { data: profiles } = await auth.admin
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return mobileJson({
    apiVersion: "v1",
    providers: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      businessName: row.business_name,
      categories: row.categories,
      areasServed: row.areas_served,
      description: row.description,
      priceRange: row.price_range,
      phone: row.phone,
      tier: row.tier,
      status: row.status,
      createdAt: row.created_at,
      profile: row.user_id ? (profileMap.get(row.user_id) ?? null) : null,
    })),
  });
}

async function handleReviewProvider(req: Request, providerId: string): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ action?: string; rejectionReason?: string }>(req);
  if (body instanceof Response) return body;
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return mobileError("action must be approve|reject", "BAD_REQUEST", 400);
  }

  try {
    const { data: provider, error: fetchErr } = await auth.admin
      .from("service_providers")
      .select("id, user_id, business_name, status")
      .eq("id", providerId)
      .single();
    if (fetchErr || !provider) {
      return mobileError("Provider application not found", "NOT_FOUND", 404);
    }
    if (!provider.user_id) {
      return mobileError("Provider application has no linked user", "BAD_REQUEST", 400);
    }

    const { data: userData } = await auth.admin.auth.admin.getUserById(provider.user_id);
    const email = userData.user?.email ?? "";
    const name =
      (userData.user?.user_metadata?.full_name as string | undefined) ??
      provider.business_name ??
      email;

    const { notifyApplicantApproved, notifyApplicantRejected } = await import("@/lib/api/notify");

    if (action === "reject") {
      await auth.admin
        .from("service_providers")
        .update({ status: "rejected" })
        .eq("id", providerId);
      await notifyApplicantRejected({
        email,
        name,
        role: "service provider",
        reason: body.rejectionReason,
        userId: provider.user_id,
      });
      await auth.admin.from("admin_audit_logs").insert({
        admin_id: auth.userId,
        action: "SERVICE_PROVIDER_REJECTED",
        target_id: providerId,
        details: `Rejected ${provider.business_name}. ${body.rejectionReason ?? ""}`,
      });
      return mobileJson({ apiVersion: "v1", status: "rejected" });
    }

    await auth.admin.from("service_providers").update({ status: "active" }).eq("id", providerId);

    await notifyApplicantApproved({
      email,
      name,
      role: "service_provider",
      userId: provider.user_id,
    });

    await auth.admin.from("admin_audit_logs").insert({
      admin_id: auth.userId,
      action: "SERVICE_PROVIDER_APPROVED",
      target_id: providerId,
      details: `Approved ${provider.business_name}`,
    });

    return mobileJson({ apiVersion: "v1", status: "approved" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review failed";
    return mobileError(message, "ADMIN_ERROR", 400);
  }
}

// ── Admin: scam reports ──────────────────────────────────────────────────────

async function handleListScamReports(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status")?.trim();

  let query = auth.admin
    .from("scam_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data: rows, error } = await query;
  if (error) return mobileError(error.message, "ADMIN_ERROR", 400);

  const propertyIds = [
    ...new Set((rows ?? []).map((r) => r.property_id).filter(Boolean)),
  ] as string[];
  const { data: properties } = propertyIds.length
    ? await auth.admin.from("properties").select("id, title, neighborhood").in("id", propertyIds)
    : { data: [] as { id: string; title: string; neighborhood: string }[] };
  const propertyMap = new Map((properties ?? []).map((p) => [p.id, p]));

  return mobileJson({
    apiVersion: "v1",
    reports: (rows ?? []).map((row) => ({
      id: row.id,
      propertyId: row.property_id,
      reporterId: row.reporter_id,
      reason: row.reason,
      details: row.details,
      status: row.status,
      createdAt: row.created_at,
      property: row.property_id ? (propertyMap.get(row.property_id) ?? null) : null,
    })),
  });
}

async function handleUpdateScamReport(req: Request, reportId: string): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ status?: string }>(req);
  if (body instanceof Response) return body;
  if (body.status !== "reviewed" && body.status !== "dismissed") {
    return mobileError("status must be reviewed|dismissed", "BAD_REQUEST", 400);
  }

  const { data: row, error } = await auth.admin
    .from("scam_reports")
    .update({ status: body.status })
    .eq("id", reportId)
    .select("*")
    .maybeSingle();
  if (error) return mobileError(error.message, "ADMIN_ERROR", 400);
  if (!row) return mobileError("Report not found", "NOT_FOUND", 404);

  await auth.admin.from("admin_audit_logs").insert({
    admin_id: auth.userId,
    action: `SCAM_REPORT_${body.status.toUpperCase()}`,
    target_id: reportId,
    details: `Updated scam report status to ${body.status}.`,
  });

  return mobileJson({ apiVersion: "v1", report: row });
}

// ── Tenant rent SMS claim ────────────────────────────────────────────────────

type RentSmsClaimBody = {
  invoiceId?: string;
  smsText?: string;
  amountOverride?: number;
};

type RentInvoiceRow = {
  id: string;
  lease_id: string;
  status: string;
  amount_due: number | string;
  amount_paid: number | string | null;
  late_fee: number | string | null;
};

type AuthorizedRentInvoice = { invoice: RentInvoiceRow };

type AuthorizedRentInvoiceResult = Response | AuthorizedRentInvoice;

type PayableAmountResult = Response | number;

async function resolveClaimedAmountKes(
  body: RentSmsClaimBody,
  parsedAmountKes: number,
): Promise<number> {
  const { resolveSmsClaimAmountKes } = await import("@/lib/pm/sms-claim-amount");
  return resolveSmsClaimAmountKes({
    parsedAmountKes,
    amountOverride: body.amountOverride,
  });
}

async function loadAuthorizedRentInvoice(
  admin: import("@/lib/pm/access").PmDb,
  invoiceId: string,
  userId: string,
): Promise<AuthorizedRentInvoiceResult> {
  const { data: invoice } = await admin
    .from("pm_rent_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return mobileError("Invoice not found", "NOT_FOUND", 404);

  const { data: lease } = await admin
    .from("pm_leases")
    .select("id, tenant_id")
    .eq("id", invoice.lease_id)
    .maybeSingle();
  if (!lease) return mobileError("Lease not found", "NOT_FOUND", 404);

  const { data: tenant } = await admin
    .from("pm_tenants")
    .select("id, tenant_user_id, portal_status")
    .eq("id", lease.tenant_id)
    .eq("tenant_user_id", userId)
    .eq("portal_status", "accepted")
    .is("deleted_at", null)
    .maybeSingle();
  if (!tenant) return mobileError("Not authorised for this invoice", "FORBIDDEN", 403);

  return { invoice: invoice as RentInvoiceRow };
}

function validateInvoicePayableAmount(
  invoice: RentInvoiceRow,
  claimedAmountKes: number,
  rentBalanceRemaining: (due: number, paid: number, lateFee: number) => number,
): PayableAmountResult {
  if (invoice.status === "paid") {
    return mobileError("This invoice is already fully paid", "BAD_REQUEST", 400);
  }

  const balance = rentBalanceRemaining(
    Number(invoice.amount_due),
    Number(invoice.amount_paid ?? 0),
    Number(invoice.late_fee ?? 0),
  );
  if (balance <= 0) {
    return mobileError("Nothing left to pay on this invoice", "BAD_REQUEST", 400);
  }
  return Math.min(claimedAmountKes, balance);
}

async function handleRentSmsClaim(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<RentSmsClaimBody>(req);
  if (body instanceof Response) return body;

  const invoiceId = typeof body.invoiceId === "string" ? parseUuid(body.invoiceId) : null;
  const smsText = typeof body.smsText === "string" ? body.smsText.trim() : "";
  if (!invoiceId) return mobileError("invoiceId required", "BAD_REQUEST", 400);
  if (smsText.length < 20) {
    return mobileError("Paste the full M-Pesa confirmation SMS", "BAD_REQUEST", 400);
  }

  try {
    const { asPmDb } = await import("@/lib/pm/access");
    const { parseMpesaSms } = await import("@/lib/pm/parse-mpesa-sms");
    const { rentBalanceRemaining } = await import("@/lib/pm/invoice-status");
    const { fulfillPmRentFromSms } = await import("@/lib/pm/rent-fulfillment");

    const parsed = parseMpesaSms(smsText);
    if (!parsed) {
      return mobileError(
        "Could not read that M-Pesa message. Paste the full confirmation SMS.",
        "BAD_REQUEST",
        400,
      );
    }

    const admin = asPmDb(auth.admin);
    const authorized = await loadAuthorizedRentInvoice(admin, invoiceId, auth.userId);
    if (authorized instanceof Response) return authorized;

    const claimedAmountKes = await resolveClaimedAmountKes(body, parsed.amountKes);
    const amountKes = validateInvoicePayableAmount(
      authorized.invoice,
      claimedAmountKes,
      rentBalanceRemaining,
    );
    if (amountKes instanceof Response) return amountKes;

    const result = await fulfillPmRentFromSms(admin, {
      invoiceId,
      amountKes,
      userId: auth.userId,
      mpesaReceipt: parsed.receipt,
      paidAt: parsed.paidAt,
      rawSms: parsed.raw,
    });

    return mobileJson({ apiVersion: "v1", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMS claim failed";
    return mobileError(message, "RENT_ERROR", 400);
  }
}

/**
 * Wave 12 Mobile BFF — admin application/provider/scam queues + rent SMS claim.
 */
export async function tryHandleWave12(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const exact: Record<string, (r: Request) => Promise<Response>> = {
    "GET /admin/portal-applications": handleListPortalApplications,
    "GET /admin/service-providers": handleListPendingProviders,
    "GET /admin/scam-reports": handleListScamReports,
    "POST /tenants/rent/sms-claim": handleRentSmsClaim,
  };

  const exactKey = `${method} ${rest}`;
  const exactHandler = exact[exactKey];
  if (exactHandler) return exactHandler(req);

  const appReview = /^\/admin\/portal-applications\/([^/]+)\/review$/.exec(rest);
  if (appReview && method === "POST") {
    const id = parseUuid(appReview[1]);
    if (!id) return mobileError("Invalid application id", "BAD_REQUEST", 400);
    return handleReviewPortalApplication(req, id);
  }

  const providerReview = /^\/admin\/service-providers\/([^/]+)\/review$/.exec(rest);
  if (providerReview && method === "POST") {
    const id = parseUuid(providerReview[1]);
    if (!id) return mobileError("Invalid provider id", "BAD_REQUEST", 400);
    return handleReviewProvider(req, id);
  }

  const scamPatch = /^\/admin\/scam-reports\/([^/]+)$/.exec(rest);
  if (scamPatch && method === "PATCH") {
    const id = parseUuid(scamPatch[1]);
    if (!id) return mobileError("Invalid report id", "BAD_REQUEST", 400);
    return handleUpdateScamReport(req, id);
  }

  return null;
}
