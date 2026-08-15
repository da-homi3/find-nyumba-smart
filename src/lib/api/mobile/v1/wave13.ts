import {
  mobileError,
  mobileJson,
  requireMobileBearer,
  userHasRole,
  type MobileAdmin,
} from "@/lib/api/mobile/v1/auth";
import { mapPmError, parseJsonBody, parseUuid, requireAdmin } from "@/lib/api/mobile/v1/helpers";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const PORTAL_ROLES = ["landlord", "agency", "manager", "admin"] as const;
const STAFF_ROLES = [
  "owner",
  "property_manager",
  "caretaker",
  "security",
  "accountant",
  "maintenance_supervisor",
  "reception",
] as const;

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

async function requirePortalRole(admin: MobileAdmin, userId: string): Promise<Response | null> {
  for (const role of PORTAL_ROLES) {
    if (await userHasRole(admin, userId, role as AppRole)) return null;
  }
  return mobileError("Portal role required", "FORBIDDEN", 403);
}

// ── PM complaints ────────────────────────────────────────────────────────────

async function handleListPmComplaints(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  try {
    const { asPmDb, assertPmPropertyAccess, assertStaffCan } = await import("@/lib/pm/access");
    const admin = asPmDb(auth.admin);
    const { staffRole } = await assertPmPropertyAccess(admin, auth.userId, propertyId);
    assertStaffCan(staffRole, "complaints:view");

    const { data: rows, error } = await admin
      .from("pm_complaints")
      .select("*")
      .eq("property_id", propertyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const unitIds = [...new Set((rows ?? []).map((r) => r.unit_id).filter(Boolean))] as string[];
    const tenantIds = [
      ...new Set((rows ?? []).map((r) => r.tenant_id).filter(Boolean)),
    ] as string[];

    const [{ data: units }, { data: tenants }] = await Promise.all([
      unitIds.length
        ? admin.from("pm_units").select("id, unit_label").in("id", unitIds)
        : Promise.resolve({ data: [] as { id: string; unit_label: string }[] }),
      tenantIds.length
        ? admin.from("pm_tenants").select("id, full_name").in("id", tenantIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    ]);

    const unitById = new Map((units ?? []).map((u) => [u.id, u]));
    const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));

    return mobileJson({
      apiVersion: "v1",
      complaints: (rows ?? []).map((r) => ({
        id: r.id,
        propertyId: r.property_id,
        unitId: r.unit_id,
        tenantId: r.tenant_id,
        subject: r.subject,
        body: r.body,
        status: r.status,
        landlordReply: r.landlord_reply,
        createdAt: r.created_at,
        repliedAt: r.replied_at,
        unitLabel: r.unit_id ? (unitById.get(r.unit_id)?.unit_label ?? null) : null,
        tenantName: r.tenant_id ? (tenantById.get(r.tenant_id)?.full_name ?? null) : null,
      })),
    });
  } catch (err) {
    return mapPmError(err, "mobile pm complaints");
  }
}

async function handleReplyPmComplaint(req: Request, complaintId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<{ reply?: string }>(req);
  if (body instanceof Response) return body;
  const reply = typeof body.reply === "string" ? body.reply.trim() : "";
  if (!reply) return mobileError("reply is required", "BAD_REQUEST", 400);

  try {
    const { asPmDb, assertPmPropertyAccess, assertStaffCan } = await import("@/lib/pm/access");
    const { notifyTenantComplaintReply } = await import("@/lib/pm/complaints-notify");
    const admin = asPmDb(auth.admin);

    const { data: row } = await admin
      .from("pm_complaints")
      .select("id, property_id, status, seen_at")
      .eq("id", complaintId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!row) return mobileError("Complaint not found", "NOT_FOUND", 404);

    const { staffRole } = await assertPmPropertyAccess(admin, auth.userId, row.property_id);
    assertStaffCan(staffRole, "complaints:*");

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      landlord_reply: reply,
      replied_at: now,
      replied_by: auth.userId,
      status: "replied",
    };
    if (!row.seen_at) {
      patch.seen_at = now;
      patch.seen_by = auth.userId;
    }

    const { error } = await admin.from("pm_complaints").update(patch).eq("id", complaintId);
    if (error) throw error;

    void notifyTenantComplaintReply(admin, complaintId, reply).catch((err) => {
      console.warn("[mobile complaints] tenant reply notify failed", err);
    });

    return mobileJson({ apiVersion: "v1", ok: true, complaintId });
  } catch (err) {
    return mapPmError(err, "mobile pm complaint reply");
  }
}

async function handleMarkComplaintSeen(req: Request, complaintId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  try {
    const { asPmDb, assertPmPropertyAccess, assertStaffCan } = await import("@/lib/pm/access");
    const admin = asPmDb(auth.admin);

    const { data: row } = await admin
      .from("pm_complaints")
      .select("id, property_id, status")
      .eq("id", complaintId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!row) return mobileError("Complaint not found", "NOT_FOUND", 404);

    const { staffRole } = await assertPmPropertyAccess(admin, auth.userId, row.property_id);
    assertStaffCan(staffRole, "complaints:*");

    if (row.status === "open") {
      await admin
        .from("pm_complaints")
        .update({
          status: "seen",
          seen_at: new Date().toISOString(),
          seen_by: auth.userId,
        })
        .eq("id", complaintId);
    }

    return mobileJson({ apiVersion: "v1", ok: true });
  } catch (err) {
    return mapPmError(err, "mobile pm complaint seen");
  }
}

// ── PM staff ─────────────────────────────────────────────────────────────────

async function handleListPmStaff(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  try {
    const { asPmDb, assertPmPropertyAccess, assertStaffCan } = await import("@/lib/pm/access");
    const admin = asPmDb(auth.admin);
    const { staffRole } = await assertPmPropertyAccess(admin, auth.userId, propertyId);
    assertStaffCan(staffRole, "staff:view");

    const { data: rows, error } = await admin
      .from("pm_property_staff")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at");
    if (error) throw error;

    const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
    const { data: profiles } = userIds.length
      ? await auth.admin.from("profiles").select("id, full_name, phone").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null; phone: string | null }[] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return mobileJson({
      apiVersion: "v1",
      staff: (rows ?? []).map((r) => ({
        id: r.id,
        propertyId: r.property_id,
        userId: r.user_id,
        role: r.role,
        createdAt: r.created_at,
        profile: profileMap.get(r.user_id) ?? null,
      })),
    });
  } catch (err) {
    return mapPmError(err, "mobile pm staff");
  }
}

async function handleUpsertPmStaff(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<{ userId?: string; role?: string; email?: string }>(req);
  if (body instanceof Response) return body;

  const role = typeof body.role === "string" ? body.role.trim() : "";
  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    return mobileError("Invalid staff role", "BAD_REQUEST", 400);
  }

  try {
    const { asPmDb, assertPmPropertyAccess } = await import("@/lib/pm/access");
    const { ForbiddenError } = await import("@/lib/api/_authz");
    const admin = asPmDb(auth.admin);
    const { staffRole } = await assertPmPropertyAccess(admin, auth.userId, propertyId);
    if (staffRole !== "owner") {
      throw new ForbiddenError("Only the property owner can manage staff");
    }

    let targetUserId =
      typeof body.userId === "string" && parseUuid(body.userId) ? body.userId : null;

    if (!targetUserId && typeof body.email === "string" && body.email.includes("@")) {
      const email = body.email.trim().toLowerCase();
      const { data: listed } = await auth.admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = (listed.users ?? []).find((u) => u.email?.toLowerCase() === email);
      if (!match) {
        return mobileError("No user found with that email", "NOT_FOUND", 404);
      }
      targetUserId = match.id;
    }

    if (!targetUserId) {
      return mobileError("userId or email required", "BAD_REQUEST", 400);
    }

    const { data: row, error } = await admin
      .from("pm_property_staff")
      .upsert(
        {
          property_id: propertyId,
          user_id: targetUserId,
          role,
        },
        { onConflict: "property_id,user_id" },
      )
      .select("*")
      .single();
    if (error) throw error;

    return mobileJson({ apiVersion: "v1", staff: row }, 201);
  } catch (err) {
    return mapPmError(err, "mobile pm staff upsert");
  }
}

// ── Provider register / me ───────────────────────────────────────────────────

type ProviderRegisterBody = {
  businessName?: string;
  categories?: string[];
  areasServed?: string[];
  counties?: string[];
  description?: string;
  priceRange?: string;
  phone?: string;
  sourceUrl?: string;
};

type ValidatedProviderRegister = {
  businessName: string;
  phone: string;
  categories: string[];
  areasServed: string[];
  counties: string[];
  description: string | null;
  priceRange: string | null;
  sourceUrl: string | null;
};

function stringList(value: unknown, allowEmpty = true): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && (allowEmpty || item.trim().length > 0),
  );
}

function optionalTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateProviderRegister(
  body: ProviderRegisterBody,
): ValidatedProviderRegister | Response {
  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const categories = stringList(body.categories).filter((c) =>
    (PROVIDER_CATEGORIES as readonly string[]).includes(c),
  );
  const areasServed = stringList(body.areasServed, false);

  if (businessName.length < 2) {
    return mobileError("businessName is required", "BAD_REQUEST", 400);
  }
  if (!categories.length) return mobileError("Select at least one category", "BAD_REQUEST", 400);
  if (!areasServed.length) return mobileError("areasServed is required", "BAD_REQUEST", 400);
  if (phone.length < 9) return mobileError("phone is required", "BAD_REQUEST", 400);

  const countiesRaw = stringList(body.counties, false);
  return {
    businessName,
    phone,
    categories,
    areasServed,
    counties: countiesRaw.length ? countiesRaw : ["Nairobi"],
    description: optionalTrimmed(body.description),
    priceRange: optionalTrimmed(body.priceRange),
    sourceUrl: optionalTrimmed(body.sourceUrl),
  };
}

function providerRegisterPayload(validated: ValidatedProviderRegister) {
  return {
    business_name: validated.businessName,
    categories: validated.categories,
    areas_served: validated.areasServed,
    counties: validated.counties,
    description: validated.description,
    price_range: validated.priceRange,
    phone: validated.phone,
    source_url: validated.sourceUrl,
  };
}

async function updateExistingProvider(
  admin: MobileAdmin,
  existing: { id: string; status: string },
  payload: ReturnType<typeof providerRegisterPayload>,
): Promise<Response> {
  const resubmit = existing.status === "rejected" ? { status: "pending" as const } : {};
  const { data: updated, error } = await admin
    .from("service_providers")
    .update({ ...payload, ...resubmit })
    .eq("id", existing.id)
    .select("id, status")
    .single();
  if (error) throw error;
  return mobileJson({ apiVersion: "v1", id: updated.id, status: updated.status });
}

async function insertNewProvider(
  admin: MobileAdmin,
  userId: string,
  userEmail: string | undefined,
  validated: ValidatedProviderRegister,
  payload: ReturnType<typeof providerRegisterPayload>,
): Promise<Response> {
  const { data: row, error } = await admin
    .from("service_providers")
    .insert({
      user_id: userId,
      ...payload,
      status: "pending",
      tier: "basic",
    })
    .select("id, status")
    .single();
  if (error) throw error;

  try {
    const { notifyOpsNewApplication } = await import("@/lib/api/notify");
    const { getSiteUrl } = await import("@/lib/site");
    await notifyOpsNewApplication({
      applicantName: validated.businessName,
      applicantEmail: userEmail ?? validated.phone,
      role: "service_provider",
      orgName: validated.businessName,
      reviewUrl: `${getSiteUrl()}/admin?tab=providers`,
    });
  } catch (err) {
    console.warn("[mobile provider] ops notify failed", err);
  }

  return mobileJson({ apiVersion: "v1", id: row.id, status: row.status }, 201);
}

async function handleRegisterProvider(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<ProviderRegisterBody>(req);
  if (body instanceof Response) return body;

  const validated = validateProviderRegister(body);
  if (validated instanceof Response) return validated;

  try {
    const { data: existing } = await auth.admin
      .from("service_providers")
      .select("id, status")
      .eq("user_id", auth.userId)
      .maybeSingle();

    const payload = providerRegisterPayload(validated);
    if (existing) return updateExistingProvider(auth.admin, existing, payload);
    return insertNewProvider(auth.admin, auth.userId, auth.user.email, validated, payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not register provider";
    return mobileError(message, "PROVIDER_ERROR", 400);
  }
}

async function handleProviderMe(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const { data: provider } = await auth.admin
    .from("service_providers")
    .select("*")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!provider) {
    return mobileJson({ apiVersion: "v1", provider: null, inquiries: [] });
  }

  const { data: inquiries } = await auth.admin
    .from("provider_inquiries")
    .select("id, message, created_at, tenant_user_id")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return mobileJson({
    apiVersion: "v1",
    provider,
    inquiries: inquiries ?? [],
  });
}

async function handlePatchProviderMe(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<ProviderRegisterBody>(req);
  if (body instanceof Response) return body;

  const validated = validateProviderRegister(body);
  if (validated instanceof Response) return validated;

  const { data: existing } = await auth.admin
    .from("service_providers")
    .select("id, status")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!existing) {
    return mobileError("Provider profile not found", "NOT_FOUND", 404);
  }
  if (existing.status === "suspended") {
    return mobileError("Your account is suspended. Contact customer care.", "FORBIDDEN", 403);
  }

  try {
    const payload = providerRegisterPayload(validated);
    const resubmit = existing.status === "rejected" ? { status: "pending" as const } : {};
    const { data: updated, error } = await auth.admin
      .from("service_providers")
      .update({ ...payload, ...resubmit })
      .eq("id", existing.id)
      .select(
        "id, status, business_name, phone, categories, areas_served, counties, description, price_range",
      )
      .single();
    if (error) throw error;
    return mobileJson({ apiVersion: "v1", provider: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update provider";
    return mobileError(message, "PROVIDER_ERROR", 400);
  }
}

async function handleProviderCategories(): Promise<Response> {
  return mobileJson({
    apiVersion: "v1",
    categories: PROVIDER_CATEGORIES.map((id) => ({
      id,
      label: id.replaceAll("_", " "),
    })),
  });
}

// ── Admin listing moderation ─────────────────────────────────────────────────

async function handleAdminListProperties(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 50;
  const q = (url.searchParams.get("q") ?? "").trim();

  let query = auth.admin
    .from("properties")
    .select(
      "id, title, neighborhood, is_active, is_verified, rent_kes, authenticity_score, owner_id, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (q) {
    query = query.or(`title.ilike.%${q}%,neighborhood.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return mobileError(error.message, "ADMIN_ERROR", 400);
  return mobileJson({ apiVersion: "v1", properties: data ?? [] });
}

async function handleAdminSetPropertyActive(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ isActive?: boolean }>(req);
  if (body instanceof Response) return body;
  if (typeof body.isActive !== "boolean") {
    return mobileError("isActive must be a boolean", "BAD_REQUEST", 400);
  }

  const { data: row, error } = await auth.admin
    .from("properties")
    .update({
      is_active: body.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", propertyId)
    .select("id, title, is_active")
    .maybeSingle();
  if (error) return mobileError(error.message, "ADMIN_ERROR", 400);
  if (!row) return mobileError("Listing not found", "NOT_FOUND", 404);

  await auth.admin.from("admin_audit_logs").insert({
    admin_id: auth.userId,
    action: body.isActive ? "PROPERTY_REACTIVATED" : "PROPERTY_SOFT_DELETED",
    target_id: propertyId,
    details: `${body.isActive ? "Reactivated" : "Soft-deleted"} listing: ${row.title}`,
  });

  try {
    const { invalidateListingCaches } = await import("@/lib/cache/manager");
    await invalidateListingCaches();
  } catch {
    // best-effort
  }

  return mobileJson({ apiVersion: "v1", property: row });
}

type UuidParamRoute = {
  method: string;
  pattern: RegExp;
  invalidMessage: string;
  handle: (req: Request, id: string) => Promise<Response>;
};

function matchUuidParam(rest: string, pattern: RegExp): string | null | undefined {
  const match = pattern.exec(rest);
  if (!match) return undefined;
  return parseUuid(match[1]);
}

async function tryWave13UuidRoutes(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const routes: readonly UuidParamRoute[] = [
    {
      method: "GET",
      pattern: /^\/property-management\/properties\/([^/]+)\/complaints$/,
      invalidMessage: "Invalid property id",
      handle: handleListPmComplaints,
    },
    {
      method: "POST",
      pattern: /^\/property-management\/complaints\/([^/]+)\/reply$/,
      invalidMessage: "Invalid complaint id",
      handle: handleReplyPmComplaint,
    },
    {
      method: "POST",
      pattern: /^\/property-management\/complaints\/([^/]+)\/seen$/,
      invalidMessage: "Invalid complaint id",
      handle: handleMarkComplaintSeen,
    },
    {
      method: "GET",
      pattern: /^\/property-management\/properties\/([^/]+)\/staff$/,
      invalidMessage: "Invalid property id",
      handle: handleListPmStaff,
    },
    {
      method: "POST",
      pattern: /^\/property-management\/properties\/([^/]+)\/staff$/,
      invalidMessage: "Invalid property id",
      handle: handleUpsertPmStaff,
    },
    {
      method: "POST",
      pattern: /^\/admin\/properties\/([^/]+)\/active$/,
      invalidMessage: "Invalid property id",
      handle: handleAdminSetPropertyActive,
    },
  ];

  for (const route of routes) {
    if (route.method !== method) continue;
    const id = matchUuidParam(rest, route.pattern);
    if (id === undefined) continue;
    if (id === null) return mobileError(route.invalidMessage, "BAD_REQUEST", 400);
    return route.handle(req, id);
  }
  return null;
}

/**
 * Wave 13 Mobile BFF — PM complaints/staff, provider register/me, admin listing moderation.
 */
export async function tryHandleWave13(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const exact: Record<string, (r: Request) => Promise<Response>> = {
    "GET /providers/categories": () => handleProviderCategories(),
    "GET /providers/me": handleProviderMe,
    "PATCH /providers/me": handlePatchProviderMe,
    "POST /providers": handleRegisterProvider,
    "GET /admin/properties": handleAdminListProperties,
  };

  const exactHandler = exact[`${method} ${rest}`];
  if (exactHandler) return exactHandler(req);

  return tryWave13UuidRoutes(req, rest, method);
}
