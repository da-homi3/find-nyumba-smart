import { parseUuid, parseJsonBody, mapPmError, requireAdmin } from "@/lib/api/mobile/v1/helpers";
import { mobileError, mobileJson, requireMobileBearer } from "@/lib/api/mobile/v1/auth";
import { asPmDb, assertPmPropertyAccess, assertStaffCan } from "@/lib/pm/access";
import { seedCurrentPeriodInvoiceForLease } from "@/lib/pm/invoice-seed";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VERIFY_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;

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

// ── Leases ───────────────────────────────────────────────────────────────────

async function handleListPmLeases(req: Request, propertyId: string): Promise<Response> {
  const ctx = await withPmWriteAccess(req, propertyId, "leases:view");
  if (ctx instanceof Response) return ctx;

  const { data: units } = await ctx.admin
    .from("pm_units")
    .select("id, unit_label")
    .eq("property_id", propertyId)
    .is("deleted_at", null);

  const unitIds = (units ?? []).map((u: { id: string }) => u.id);
  if (!unitIds.length) return mobileJson({ apiVersion: "v1", items: [] });

  const { data: leases, error } = await ctx.admin
    .from("pm_leases")
    .select("*")
    .in("unit_id", unitIds)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("mobile list leases:", error.message);
    return mobileError("Could not load leases", "PM_ERROR", 500);
  }

  const unitById = new Map(
    (units ?? []).map((u: { id: string; unit_label: string }) => [u.id, u.unit_label]),
  );

  const items = (leases ?? []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    unitId: l.unit_id as string,
    tenantId: l.tenant_id as string,
    monthlyRent: Number(l.monthly_rent),
    depositPaid: Number(l.deposit_paid ?? 0),
    startDate: l.start_date as string,
    endDate: l.end_date as string,
    status: l.status as string,
    unitLabel: unitById.get(l.unit_id as string) ?? null,
    createdAt: l.created_at as string,
  }));

  return mobileJson({ apiVersion: "v1", items });
}

async function handleCreatePmLease(req: Request, propertyId: string): Promise<Response> {
  const ctx = await withPmWriteAccess(req, propertyId, "leases:create");
  if (ctx instanceof Response) return ctx;

  const body = await parseJsonBody<{
    unitId?: string;
    tenantId?: string;
    monthlyRent?: number;
    depositPaid?: number;
    startDate?: string;
    endDate?: string;
  }>(req);
  if (body instanceof Response) return body;

  const unitId = parseUuid(body.unitId);
  const tenantId = parseUuid(body.tenantId);
  if (!unitId || !tenantId) {
    return mobileError("unitId and tenantId required", "BAD_REQUEST", 400);
  }

  const monthlyRent = body.monthlyRent;
  if (typeof monthlyRent !== "number" || !Number.isFinite(monthlyRent) || monthlyRent < 0) {
    return mobileError("monthlyRent must be a non-negative number", "BAD_REQUEST", 400);
  }

  const startDate = typeof body.startDate === "string" ? body.startDate.trim() : "";
  const endDate = typeof body.endDate === "string" ? body.endDate.trim() : "";
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return mobileError("startDate and endDate must be YYYY-MM-DD", "BAD_REQUEST", 400);
  }

  const { data: unit } = await ctx.admin
    .from("pm_units")
    .select("id, property_id")
    .eq("id", unitId)
    .is("deleted_at", null)
    .maybeSingle();
  if (unit?.property_id !== propertyId) {
    return mobileError("Unit not found on this property", "NOT_FOUND", 404);
  }

  const { data: tenant } = await ctx.admin
    .from("pm_tenants")
    .select("id, property_id")
    .eq("id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (tenant?.property_id !== propertyId) {
    return mobileError("Tenant must belong to the same property", "BAD_REQUEST", 400);
  }

  const { data: row, error } = await ctx.admin
    .from("pm_leases")
    .insert({
      unit_id: unitId,
      tenant_id: tenantId,
      monthly_rent: Math.trunc(monthlyRent),
      deposit_paid: typeof body.depositPaid === "number" ? Math.trunc(body.depositPaid) : 0,
      start_date: startDate,
      end_date: endDate,
      status: "active",
    })
    .select("*")
    .single();

  if (error) {
    console.error("mobile create lease:", error.message);
    return mobileError(error.message, "PM_ERROR", 400);
  }

  await ctx.admin
    .from("pm_units")
    .update({ status: "occupied", updated_at: new Date().toISOString() })
    .eq("id", unitId);

  try {
    await seedCurrentPeriodInvoiceForLease(ctx.admin, {
      id: row.id,
      monthly_rent: Math.trunc(monthlyRent),
    });
  } catch (err) {
    console.warn("[mobile lease] invoice seed failed", err);
  }

  return mobileJson({ apiVersion: "v1", lease: row }, 201);
}

// ── Rent invoices ────────────────────────────────────────────────────────────

async function handleListPmRent(req: Request, propertyId: string): Promise<Response> {
  const ctx = await withPmWriteAccess(req, propertyId, "invoices:view");
  if (ctx instanceof Response) return ctx;

  const { data: units } = await ctx.admin
    .from("pm_units")
    .select("id, unit_label")
    .eq("property_id", propertyId)
    .is("deleted_at", null);
  const unitIds = (units ?? []).map((u: { id: string }) => u.id);
  if (!unitIds.length) return mobileJson({ apiVersion: "v1", items: [] });

  const { data: leases } = await ctx.admin
    .from("pm_leases")
    .select("id, unit_id, tenant_id, monthly_rent")
    .in("unit_id", unitIds);
  const leaseIds = (leases ?? []).map((l: { id: string }) => l.id);
  if (!leaseIds.length) return mobileJson({ apiVersion: "v1", items: [] });

  const { data: invoices, error } = await ctx.admin
    .from("pm_rent_invoices")
    .select("id, lease_id, period_month, due_date, status, amount_due, amount_paid, late_fee")
    .in("lease_id", leaseIds)
    .order("period_month", { ascending: false })
    .limit(240);

  if (error) {
    console.error("mobile list rent:", error.message);
    return mobileError("Could not load rent invoices", "PM_ERROR", 500);
  }

  const invoiceIds = (invoices ?? []).map((inv: { id: string }) => inv.id);
  const { data: payments } = invoiceIds.length
    ? await ctx.admin
        .from("pm_rent_payments")
        .select("id, invoice_id, amount, method, mpesa_receipt_number, paid_at, note")
        .in("invoice_id", invoiceIds)
        .order("paid_at", { ascending: false })
    : { data: [] };

  const paymentsByInvoice = new Map<string, Array<Record<string, unknown>>>();
  for (const pay of payments ?? []) {
    const invId = pay.invoice_id as string;
    const list = paymentsByInvoice.get(invId) ?? [];
    if (list.length < 8) list.push(pay as Record<string, unknown>);
    paymentsByInvoice.set(invId, list);
  }

  const tenantIds = [
    ...new Set((leases ?? []).map((l: { tenant_id: string }) => l.tenant_id).filter(Boolean)),
  ];
  const { data: tenants } = tenantIds.length
    ? await ctx.admin.from("pm_tenants").select("id, full_name").in("id", tenantIds)
    : { data: [] };
  const tenantNameById = new Map(
    (tenants ?? []).map((t: { id: string; full_name: string }) => [t.id, t.full_name]),
  );

  const unitById = new Map(
    (units ?? []).map((u: { id: string; unit_label: string }) => [u.id, u.unit_label]),
  );
  const leaseById = new Map(
    (leases ?? []).map(
      (l: { id: string; unit_id: string; tenant_id: string; monthly_rent: number }) => [l.id, l],
    ),
  );

  const now = new Date();
  const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const thisYear = String(now.getUTCFullYear());
  let collectedMonth = 0;
  let collectedYear = 0;
  let outstanding = 0;

  const items = (invoices ?? []).map((inv: Record<string, unknown>) => {
    const lease = leaseById.get(inv.lease_id as string);
    const pays = paymentsByInvoice.get(inv.id as string) ?? [];
    const amountDue = Number(inv.amount_due);
    const amountPaid = Number(inv.amount_paid);
    const lateFee = Number(inv.late_fee ?? 0);
    const balance = Math.max(0, amountDue + lateFee - amountPaid);
    const periodMonth = inv.period_month as string;
    if (periodMonth === thisMonth) collectedMonth += amountPaid;
    if (periodMonth.startsWith(thisYear)) collectedYear += amountPaid;
    outstanding += balance;
    const tenantId = lease?.tenant_id ?? null;
    return {
      id: inv.id as string,
      leaseId: inv.lease_id as string,
      periodMonth,
      dueDate: inv.due_date as string,
      status: inv.status as string,
      amountDue,
      amountPaid,
      lateFee,
      balanceRemaining: balance,
      unitLabel: lease ? (unitById.get(lease.unit_id) ?? null) : null,
      tenantId,
      tenantName: tenantId ? (tenantNameById.get(tenantId) ?? null) : null,
      leaseMonthlyRent: lease ? Number(lease.monthly_rent) : null,
      payments: pays.map((p) => ({
        id: p.id as string,
        amount: Number(p.amount),
        method: p.method as string,
        mpesaReceiptNumber: (p.mpesa_receipt_number as string | null) ?? null,
        paidAt: p.paid_at as string,
        note: (p.note as string | null) ?? null,
      })),
    };
  });

  return mobileJson({
    apiVersion: "v1",
    summary: {
      periodMonth: thisMonth,
      year: thisYear,
      collectedMonth,
      collectedYear,
      outstanding,
    },
    items,
  });
}

async function applyMonthlyRentToOpenInvoiceMobile(
  admin: ReturnType<typeof asPmDb>,
  leaseId: string,
  monthlyRent: number,
): Promise<Response | boolean> {
  const { invoiceStatusAfterPayment } = await import("@/lib/pm/invoice-status");
  const periodMonth = new Date().toISOString().slice(0, 7);
  const { data: openInv } = await admin
    .from("pm_rent_invoices")
    .select("id, amount_paid")
    .eq("lease_id", leaseId)
    .eq("period_month", periodMonth)
    .in("status", ["pending", "partial", "overdue"])
    .maybeSingle();
  if (!openInv) return false;

  const paid = Number(openInv.amount_paid ?? 0);
  if (monthlyRent < paid) {
    return mobileError(
      `Cannot set rent below amount already paid this month (${paid} KES)`,
      "BAD_REQUEST",
      400,
    );
  }
  const nextStatus = invoiceStatusAfterPayment(monthlyRent, paid, 0);
  await admin
    .from("pm_rent_invoices")
    .update({ amount_due: monthlyRent, status: nextStatus })
    .eq("id", openInv.id);
  return true;
}

async function handlePatchPmLeaseRent(req: Request, leaseId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{
    monthlyRent?: number;
    applyToCurrentInvoice?: boolean;
  }>(req);
  if (body instanceof Response) return body;

  const monthlyRent = body.monthlyRent;
  if (typeof monthlyRent !== "number" || !Number.isInteger(monthlyRent) || monthlyRent < 0) {
    return mobileError("monthlyRent must be a non-negative integer", "BAD_REQUEST", 400);
  }

  try {
    const admin = asPmDb(auth.admin);
    const { data: lease } = await admin
      .from("pm_leases")
      .select("id, unit_id, status")
      .eq("id", leaseId)
      .maybeSingle();
    if (!lease) return mobileError("Lease not found", "NOT_FOUND", 404);
    if (lease.status !== "active") {
      return mobileError("Only active leases can be updated", "BAD_REQUEST", 400);
    }

    const { data: unit } = await admin
      .from("pm_units")
      .select("id, property_id")
      .eq("id", lease.unit_id)
      .maybeSingle();
    if (!unit) return mobileError("Unit not found", "NOT_FOUND", 404);

    const { staffRole } = await assertPmPropertyAccess(admin, auth.userId, unit.property_id);
    assertStaffCan(staffRole, "leases:create");

    const { error } = await admin
      .from("pm_leases")
      .update({ monthly_rent: monthlyRent })
      .eq("id", leaseId);
    if (error) return mobileError(error.message, "PM_ERROR", 400);

    let currentInvoiceUpdated = false;
    if (body.applyToCurrentInvoice) {
      const applied = await applyMonthlyRentToOpenInvoiceMobile(admin, leaseId, monthlyRent);
      if (applied instanceof Response) return applied;
      currentInvoiceUpdated = applied;
    }

    return mobileJson({
      apiVersion: "v1",
      ok: true,
      leaseId,
      monthlyRent,
      currentInvoiceUpdated,
    });
  } catch (err) {
    return mapPmError(err);
  }
}

async function handlePatchPmInvoiceAmount(req: Request, invoiceId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ amountDue?: number }>(req);
  if (body instanceof Response) return body;

  const amountDue = body.amountDue;
  if (typeof amountDue !== "number" || !Number.isInteger(amountDue) || amountDue < 0) {
    return mobileError("amountDue must be a non-negative integer", "BAD_REQUEST", 400);
  }

  try {
    const admin = asPmDb(auth.admin);
    const { data: invoice } = await admin
      .from("pm_rent_invoices")
      .select("id, lease_id, amount_paid, late_fee, status")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!invoice) return mobileError("Invoice not found", "NOT_FOUND", 404);

    const { data: lease } = await admin
      .from("pm_leases")
      .select("id, unit_id")
      .eq("id", invoice.lease_id)
      .maybeSingle();
    if (!lease) return mobileError("Lease not found", "NOT_FOUND", 404);

    const { data: unit } = await admin
      .from("pm_units")
      .select("id, property_id")
      .eq("id", lease.unit_id)
      .maybeSingle();
    if (!unit) return mobileError("Unit not found", "NOT_FOUND", 404);

    const { staffRole } = await assertPmPropertyAccess(admin, auth.userId, unit.property_id);
    assertStaffCan(staffRole, "invoices:create");

    const paid = Number(invoice.amount_paid ?? 0);
    if (amountDue < paid) {
      return mobileError(
        `Cannot set amount due below amount already paid (${paid} KES)`,
        "BAD_REQUEST",
        400,
      );
    }

    const { invoiceStatusAfterPayment } = await import("@/lib/pm/invoice-status");
    const status = invoiceStatusAfterPayment(
      amountDue,
      paid,
      Number(invoice.late_fee ?? 0),
    );

    const { error } = await admin
      .from("pm_rent_invoices")
      .update({ amount_due: amountDue, status })
      .eq("id", invoiceId);
    if (error) return mobileError(error.message, "PM_ERROR", 400);

    return mobileJson({ apiVersion: "v1", ok: true, invoiceId, amountDue, status });
  } catch (err) {
    return mapPmError(err);
  }
}

// ── Admin verification requests ──────────────────────────────────────────────

async function handleAdminListVerificationRequests(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const { data: rows, error } = await auth.admin
    .from("verification_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("mobile admin verification list:", error.message);
    return mobileError("Could not load verification requests", "ADMIN_ERROR", 500);
  }

  return mobileJson({ apiVersion: "v1", items: rows ?? [] });
}

async function handleAdminPatchVerificationRequest(
  req: Request,
  requestId: string,
): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{
    status?: string;
    reportUrl?: string | null;
  }>(req);
  if (body instanceof Response) return body;

  const patch: { status?: string; report_url?: string | null } = {};
  if (body.status !== undefined) {
    if (!(VERIFY_STATUSES as readonly string[]).includes(body.status)) {
      return mobileError(
        `status must be one of: ${VERIFY_STATUSES.join(", ")}`,
        "BAD_REQUEST",
        400,
      );
    }
    patch.status = body.status;
  }
  if ("reportUrl" in body) {
    if (body.reportUrl !== null && typeof body.reportUrl !== "string") {
      return mobileError("reportUrl must be a string or null", "BAD_REQUEST", 400);
    }
    patch.report_url = body.reportUrl?.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return mobileError("No valid fields to update", "BAD_REQUEST", 400);
  }

  const { data: row, error } = await auth.admin
    .from("verification_requests")
    .update(patch)
    .eq("id", requestId)
    .select("*")
    .single();

  if (error) {
    console.error("mobile admin verification patch:", error.message);
    return mobileError(error.message, "ADMIN_ERROR", 400);
  }

  await auth.admin.from("admin_audit_logs").insert({
    admin_id: auth.userId,
    action: "VERIFICATION_REQUEST_UPDATED",
    target_id: requestId,
    details: `Mobile BFF update status=${patch.status ?? "unchanged"} report_url=${patch.report_url ?? "unchanged"}`,
  });

  return mobileJson({ apiVersion: "v1", request: row });
}

/** Match `/prefix/:uuid` or `/prefix/:uuid/suffix`. Returns undefined if path shape doesn't match. */
function matchUuidPath(rest: string, prefix: string, suffix = ""): string | null | undefined {
  if (!rest.startsWith(prefix)) return undefined;
  if (suffix && !rest.endsWith(suffix)) return undefined;
  const idPart = suffix
    ? rest.slice(prefix.length, rest.length - suffix.length)
    : rest.slice(prefix.length);
  if (!idPart || idPart.includes("/")) return undefined;
  return parseUuid(idPart);
}

type UuidRoute = {
  method: string;
  prefix: string;
  suffix?: string;
  invalidMessage: string;
  handle: (req: Request, id: string) => Promise<Response>;
};

const WAVE6_EXACT: Record<string, (r: Request) => Promise<Response>> = {
  "GET /admin/verification-requests": handleAdminListVerificationRequests,
};

const WAVE6_UUID_ROUTES: readonly UuidRoute[] = [
  {
    method: "GET",
    prefix: "/property-management/properties/",
    suffix: "/leases",
    invalidMessage: "Invalid property id",
    handle: handleListPmLeases,
  },
  {
    method: "POST",
    prefix: "/property-management/properties/",
    suffix: "/leases",
    invalidMessage: "Invalid property id",
    handle: handleCreatePmLease,
  },
  {
    method: "GET",
    prefix: "/property-management/properties/",
    suffix: "/rent",
    invalidMessage: "Invalid property id",
    handle: handleListPmRent,
  },
  {
    method: "PATCH",
    prefix: "/property-management/leases/",
    suffix: "/rent",
    invalidMessage: "Invalid lease id",
    handle: handlePatchPmLeaseRent,
  },
  {
    method: "PATCH",
    prefix: "/property-management/rent/invoices/",
    invalidMessage: "Invalid invoice id",
    handle: handlePatchPmInvoiceAmount,
  },
  {
    method: "PATCH",
    prefix: "/admin/verification-requests/",
    invalidMessage: "Invalid request id",
    handle: handleAdminPatchVerificationRequest,
  },
];

/**
 * Wave 6 Mobile BFF — PM leases/rent + admin verification queue.
 */
export async function tryHandleWave6(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const exactHandler = WAVE6_EXACT[`${method} ${rest}`];
  if (exactHandler) return exactHandler(req);

  for (const route of WAVE6_UUID_ROUTES) {
    if (route.method !== method) continue;
    const id = matchUuidPath(rest, route.prefix, route.suffix ?? "");
    if (id === undefined) continue;
    if (id === null) return mobileError(route.invalidMessage, "BAD_REQUEST", 400);
    return route.handle(req, id);
  }

  return null;
}
