import { mobileError, mobileJson, requireMobileBearer } from "@/lib/api/mobile/v1/auth";
import { mapPmError, parseJsonBody, parseUuid } from "@/lib/api/mobile/v1/helpers";
import { asPmDb, assertPmPropertyAccess, assertStaffCan } from "@/lib/pm/access";
import { seedCurrentPeriodInvoiceForLease } from "@/lib/pm/invoice-seed";

const UNIT_TYPES = ["bedsitter", "1br", "2br", "3br", "4br+", "commercial", "other"] as const;
const UNIT_STATUSES = ["vacant", "occupied", "notice_given", "vacant_soon", "maintenance"] as const;

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

/** Match `/prefix/:uuidA/mid/:uuidB/suffix`. */
function matchTwoUuidPath(
  rest: string,
  prefix: string,
  mid: string,
  suffix: string,
): [string, string] | null | undefined {
  if (!rest.startsWith(prefix) || !rest.endsWith(suffix)) return undefined;
  const inner = rest.slice(prefix.length, rest.length - suffix.length);
  const midIdx = inner.indexOf(mid);
  if (midIdx < 0) return undefined;
  const a = inner.slice(0, midIdx);
  const b = inner.slice(midIdx + mid.length);
  if (!a || a.includes("/") || !b || b.includes("/")) return undefined;
  const idA = parseUuid(a);
  const idB = parseUuid(b);
  if (!idA || !idB) return null;
  return [idA, idB];
}

async function withPmWriteAccess(req: Request, propertyId: string, permission: string) {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  try {
    const admin = asPmDb(auth.admin);
    const { property, staffRole } = await assertPmPropertyAccess(admin, auth.userId, propertyId);
    assertStaffCan(staffRole, permission);
    return { admin, userId: auth.userId, property, staffRole };
  } catch (err) {
    return mapPmError(err);
  }
}

async function handlePmDashboard(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  try {
    const admin = asPmDb(auth.admin);
    await assertPmPropertyAccess(admin, auth.userId, propertyId);

    const periodMonth = new Date().toISOString().slice(0, 7);
    const in30 = new Date();
    in30.setUTCDate(in30.getUTCDate() + 30);
    const in30Iso = in30.toISOString().slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);

    const { data: units } = await admin
      .from("pm_units")
      .select("id, status")
      .eq("property_id", propertyId)
      .is("deleted_at", null);

    const totalUnits = units?.length ?? 0;
    const occupiedUnits = (units ?? []).filter((u) => u.status === "occupied").length;
    const vacantUnits = (units ?? []).filter((u) => u.status === "vacant").length;
    const unitIds = (units ?? []).map((u) => u.id);

    let expectedIncome = 0;
    let collectedThisMonth = 0;
    let outstandingRent = 0;
    let openMaintenanceRequests = 0;
    let avgMaintenanceDays: number | null = null;
    let upcomingLeaseExpirations: Array<{
      end_date: string;
      full_name: string;
      unit_label: string;
    }> = [];

    if (unitIds.length > 0) {
      const { data: leases } = await admin
        .from("pm_leases")
        .select("id, unit_id, tenant_id, end_date, status")
        .in("unit_id", unitIds)
        .eq("status", "active");

      const leaseIds = (leases ?? []).map((l) => l.id);
      const { sumRentForPeriod, avgClosedMaintenanceDays, leasesEndingSoon } =
        await import("@/lib/pm/dashboard-metrics");

      const rent = await sumRentForPeriod(admin, leaseIds, periodMonth);
      expectedIncome = rent.expectedIncome;
      collectedThisMonth = rent.collectedThisMonth;
      outstandingRent = rent.outstandingRent;

      const { count } = await admin
        .from("pm_maintenance_requests")
        .select("id", { count: "exact", head: true })
        .in("unit_id", unitIds)
        .not("status", "in", '("completed","confirmed")');
      openMaintenanceRequests = count ?? 0;
      avgMaintenanceDays = await avgClosedMaintenanceDays(admin, unitIds);
      upcomingLeaseExpirations = await leasesEndingSoon(
        admin,
        (leases ?? []) as Array<{ end_date: string; tenant_id: string; unit_id: string }>,
        todayIso,
        in30Iso,
      );
    }

    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    const { computePropertyHealthScore } = await import("@/lib/pm/property-health");
    const health = computePropertyHealthScore({
      occupancyRate,
      expectedIncomeKes: expectedIncome,
      collectedThisMonthKes: collectedThisMonth,
      totalUnits,
      vacantUnits,
      openMaintenanceRequests,
      avgMaintenanceDays,
    });

    return mobileJson({
      apiVersion: "v1",
      periodMonth,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate,
      expectedIncome,
      collectedThisMonth,
      outstandingRent,
      openMaintenanceRequests,
      avgMaintenanceDays,
      health,
      upcomingLeaseExpirations,
    });
  } catch (err) {
    return mapPmError(err, "mobile pm dashboard");
  }
}

type UnitUpdateBody = {
  unitLabel?: string;
  floor?: number | null;
  unitType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  monthlyRent?: number;
  depositAmount?: number;
  status?: string;
};

function validateUnitEnums(body: UnitUpdateBody): Response | null {
  if (body.unitType != null && !(UNIT_TYPES as readonly string[]).includes(body.unitType)) {
    return mobileError(`unitType must be one of: ${UNIT_TYPES.join(", ")}`, "BAD_REQUEST", 400);
  }
  if (body.status != null && !(UNIT_STATUSES as readonly string[]).includes(body.status)) {
    return mobileError(`status must be one of: ${UNIT_STATUSES.join(", ")}`, "BAD_REQUEST", 400);
  }
  return null;
}

function truncOrNull(value: unknown): number | null {
  return typeof value === "number" ? Math.trunc(value) : null;
}

function buildUnitPatch(body: UnitUpdateBody): Record<string, unknown> | Response {
  const enumErr = validateUnitEnums(body);
  if (enumErr) return enumErr;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.unitLabel === "string" && body.unitLabel.trim()) {
    patch.unit_label = body.unitLabel.trim();
  }
  if ("floor" in body) patch.floor = truncOrNull(body.floor);
  if ("unitType" in body) patch.unit_type = body.unitType ?? null;
  if ("bedrooms" in body) patch.bedrooms = truncOrNull(body.bedrooms);
  if ("bathrooms" in body) patch.bathrooms = truncOrNull(body.bathrooms);
  if (typeof body.monthlyRent === "number" && Number.isFinite(body.monthlyRent)) {
    patch.monthly_rent = Math.trunc(body.monthlyRent);
  }
  if (typeof body.depositAmount === "number" && Number.isFinite(body.depositAmount)) {
    patch.deposit_amount = Math.trunc(body.depositAmount);
  }
  if (typeof body.status === "string") patch.status = body.status;

  if (Object.keys(patch).length <= 1) {
    return mobileError("No valid fields to update", "BAD_REQUEST", 400);
  }
  return patch;
}

async function handleUpdatePmUnit(req: Request, unitId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<UnitUpdateBody>(req);
  if (body instanceof Response) return body;

  try {
    const admin = asPmDb(auth.admin);
    const { data: unit, error: unitErr } = await admin
      .from("pm_units")
      .select("*")
      .eq("id", unitId)
      .is("deleted_at", null)
      .maybeSingle();
    if (unitErr) throw unitErr;
    if (!unit) return mobileError("Unit not found", "NOT_FOUND", 404);

    const { staffRole } = await assertPmPropertyAccess(admin, auth.userId, unit.property_id);
    assertStaffCan(staffRole, "units:update");

    const patch = buildUnitPatch(body);
    if (patch instanceof Response) return patch;

    const { data: row, error } = await admin
      .from("pm_units")
      .update(patch)
      .eq("id", unitId)
      .select("*")
      .single();
    if (error) throw error;

    return mobileJson({ apiVersion: "v1", unit: row });
  } catch (err) {
    return mapPmError(err, "mobile pm unit update");
  }
}

async function resolveExistingUserIdByEmail(email: string): Promise<string | null> {
  try {
    const normalized = email.trim().toLowerCase();
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;

    const endpoint = new URL("/auth/v1/admin/users", url);
    endpoint.searchParams.set("page", "1");
    endpoint.searchParams.set("per_page", "50");
    endpoint.searchParams.set("email", normalized);
    const res = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { users?: Array<{ id: string; email?: string }> };
    const match = (body.users ?? []).find((u) => u.email?.toLowerCase() === normalized);
    return match?.id ?? null;
  } catch {
    return null;
  }
}

async function handleInvitePmTenant(
  req: Request,
  propertyId: string,
  tenantId: string,
): Promise<Response> {
  const ctx = await withPmWriteAccess(req, propertyId, "tenants:update");
  if (ctx instanceof Response) return ctx;

  try {
    const { data: tenant } = await ctx.admin
      .from("pm_tenants")
      .select("*")
      .eq("id", tenantId)
      .eq("property_id", propertyId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!tenant) return mobileError("Tenant not found", "NOT_FOUND", 404);
    if (!tenant.email?.trim()) {
      return mobileError(
        "Add the tenant’s email before sending a portal invite",
        "BAD_REQUEST",
        400,
      );
    }

    const { storePmTenantInvite } = await import("@/lib/pm/invite-store");
    const { tenantPortalInviteEmail } = await import("@/lib/email/templates");
    const { sendEmailResult } = await import("@/lib/email/send");
    const { getSiteUrl } = await import("@/lib/site");

    const existingUserId = await resolveExistingUserIdByEmail(tenant.email);
    const inviteToken = crypto.randomUUID();
    await storePmTenantInvite(inviteToken, {
      tenantId: tenant.id,
      existingUserId,
      propertyId: tenant.property_id,
    });

    await ctx.admin
      .from("pm_tenants")
      .update({
        portal_status: "invited",
        portal_invited_at: new Date().toISOString(),
      })
      .eq("id", tenant.id);

    const inviteUrl = `${getSiteUrl()}/tenant/invite/${inviteToken}`;
    const tpl = tenantPortalInviteEmail({
      tenantName: tenant.full_name,
      propertyName: ctx.property.name,
      inviteUrl,
      hasExistingAccount: Boolean(existingUserId),
    });
    const emailResult = await sendEmailResult({
      to: tenant.email,
      templateId: "tenant_portal_invite",
      ...tpl,
      metadata: { inviteToken, propertyId: tenant.property_id },
    });
    if (!emailResult.ok) {
      return mobileError(
        "Invitation was created but the email could not be sent. Check SendGrid and try again.",
        "EMAIL_ERROR",
        502,
      );
    }

    return mobileJson({
      apiVersion: "v1",
      success: true,
      inviteToken,
      inviteUrl,
      emailSent: true,
    });
  } catch (err) {
    return mapPmError(err, "mobile pm tenant invite");
  }
}

async function handleGenerateRent(req: Request, propertyId: string): Promise<Response> {
  const ctx = await withPmWriteAccess(req, propertyId, "invoices:create");
  if (ctx instanceof Response) return ctx;

  try {
    const { data: units } = await ctx.admin
      .from("pm_units")
      .select("id")
      .eq("property_id", propertyId)
      .is("deleted_at", null);
    const unitIds = (units ?? []).map((u) => u.id);
    if (!unitIds.length) {
      return mobileJson({
        apiVersion: "v1",
        seeded: 0,
        periodMonth: new Date().toISOString().slice(0, 7),
      });
    }

    const { data: leases } = await ctx.admin
      .from("pm_leases")
      .select("id, monthly_rent")
      .in("unit_id", unitIds)
      .eq("status", "active");

    let seeded = 0;
    for (const lease of leases ?? []) {
      await seedCurrentPeriodInvoiceForLease(ctx.admin, {
        id: lease.id,
        monthly_rent: lease.monthly_rent,
      });
      seeded += 1;
    }

    return mobileJson({
      apiVersion: "v1",
      seeded,
      periodMonth: new Date().toISOString().slice(0, 7),
    });
  } catch (err) {
    return mapPmError(err, "mobile pm rent generate");
  }
}

type UuidRoute = {
  method: string;
  prefix: string;
  suffix?: string;
  invalidMessage: string;
  handle: (req: Request, id: string) => Promise<Response>;
};

const WAVE18_UUID_ROUTES: readonly UuidRoute[] = [
  {
    method: "GET",
    prefix: "/property-management/properties/",
    suffix: "/dashboard",
    invalidMessage: "Invalid property id",
    handle: handlePmDashboard,
  },
  {
    method: "PATCH",
    prefix: "/property-management/units/",
    invalidMessage: "Invalid unit id",
    handle: handleUpdatePmUnit,
  },
  {
    method: "POST",
    prefix: "/property-management/properties/",
    suffix: "/rent/generate",
    invalidMessage: "Invalid property id",
    handle: handleGenerateRent,
  },
];

/**
 * Wave 18 Mobile BFF — PM dashboard, unit update, tenant invite, rent generate.
 */
export async function tryHandleWave18(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  for (const route of WAVE18_UUID_ROUTES) {
    if (route.method !== method) continue;
    const id = matchUuidPath(rest, route.prefix, route.suffix ?? "");
    if (id === undefined) continue;
    if (id === null) return mobileError(route.invalidMessage, "BAD_REQUEST", 400);
    return route.handle(req, id);
  }

  if (method === "POST") {
    const inviteIds = matchTwoUuidPath(
      rest,
      "/property-management/properties/",
      "/tenants/",
      "/invite",
    );
    if (inviteIds !== undefined) {
      if (inviteIds === null) {
        return mobileError("Invalid property or tenant id", "BAD_REQUEST", 400);
      }
      return handleInvitePmTenant(req, inviteIds[0], inviteIds[1]);
    }
  }

  return null;
}
