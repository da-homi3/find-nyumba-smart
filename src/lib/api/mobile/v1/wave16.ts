import {
  mobileError,
  mobileJson,
  requireMobileBearer,
  userHasRole,
  type MobileAdmin,
} from "@/lib/api/mobile/v1/auth";
import { mapPmError, parseJsonBody, parseUuid } from "@/lib/api/mobile/v1/helpers";
import type { Database } from "@/integrations/supabase/types";
import {
  canTransition,
  MAINTENANCE_STATUSES,
  type MaintenanceStatus,
} from "@/lib/maintenance/state-machine";

type AppRole = Database["public"]["Enums"]["app_role"];

const PORTAL_ROLES = ["landlord", "agency", "manager", "admin"] as const;

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

async function requirePortalRole(admin: MobileAdmin, userId: string): Promise<Response | null> {
  for (const role of PORTAL_ROLES) {
    if (await userHasRole(admin, userId, role as AppRole)) return null;
  }
  return mobileError("Portal role required", "FORBIDDEN", 403);
}

async function loadRequestWithProperty(
  admin: ReturnType<typeof import("@/lib/pm/access").asPmDb>,
  requestId: string,
) {
  const { data: request } = await admin
    .from("pm_maintenance_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) throw new Error("Maintenance request not found");

  const { data: unit } = await admin
    .from("pm_units")
    .select("id, unit_label, property_id")
    .eq("id", request.unit_id)
    .maybeSingle();
  if (!unit) throw new Error("Unit not found");

  return { request, unit };
}

function buildStatusPatch(status: string, currentStatus: string): Record<string, unknown> {
  const patch: Record<string, unknown> = { status };
  if (status === "completed") {
    patch.completed_at = new Date().toISOString();
  }
  if (status === "in_progress" && currentStatus === "completed") {
    patch.completed_at = null;
  }
  if (status === "in_progress" && currentStatus === "reported") {
    patch.assigned_at = new Date().toISOString();
  }
  return patch;
}

async function handleUpdatePmMaintenanceStatus(req: Request, requestId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<{ status?: string }>(req);
  if (body instanceof Response) return body;

  const status = body.status;
  if (!status || !(MAINTENANCE_STATUSES as readonly string[]).includes(status)) {
    return mobileError(
      `status must be one of: ${MAINTENANCE_STATUSES.join(", ")}`,
      "BAD_REQUEST",
      400,
    );
  }

  try {
    const { asPmDb, assertPmPropertyAccess, assertStaffCan } = await import("@/lib/pm/access");
    const { promptTenantConfirmation } = await import("@/lib/maintenance/notify");
    const admin = asPmDb(auth.admin);
    const { request, unit } = await loadRequestWithProperty(admin, requestId);
    const { staffRole } = await assertPmPropertyAccess(admin, auth.userId, unit.property_id);
    assertStaffCan(staffRole, "maintenance:*");

    if (!canTransition(request.status, status)) {
      return mobileError(`Cannot move from ${request.status} to ${status}`, "BAD_REQUEST", 400);
    }

    const patch = buildStatusPatch(status, request.status);
    const { error } = await admin.from("pm_maintenance_requests").update(patch).eq("id", requestId);
    if (error) throw error;

    if (status === "completed") {
      try {
        await promptTenantConfirmation(admin, requestId);
      } catch (err) {
        console.warn("[mobile maintenance] tenant confirm prompt failed", err);
      }
    }

    return mobileJson({ apiVersion: "v1", success: true, status });
  } catch (err) {
    return mapPmError(err, "mobile pm maintenance status");
  }
}

async function handleAssignPmMaintenance(req: Request, requestId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requirePortalRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<{ providerId?: string }>(req);
  if (body instanceof Response) return body;

  const providerId = typeof body.providerId === "string" ? body.providerId.trim() : "";
  if (!parseUuid(providerId)) {
    return mobileError("providerId required", "BAD_REQUEST", 400);
  }

  try {
    const { asPmDb, assertPmPropertyAccess, assertStaffCan } = await import("@/lib/pm/access");
    const { buildProviderWhatsAppUrl } = await import("@/lib/maintenance/notify");
    const { getSiteUrl } = await import("@/lib/site");
    const admin = asPmDb(auth.admin);
    const { request, unit } = await loadRequestWithProperty(admin, requestId);
    const { staffRole } = await assertPmPropertyAccess(admin, auth.userId, unit.property_id);
    assertStaffCan(staffRole, "maintenance:*");

    if (!canTransition(request.status as MaintenanceStatus, "assigned")) {
      return mobileError(
        `Cannot assign — request is currently ${request.status}`,
        "BAD_REQUEST",
        400,
      );
    }

    const { data: provider } = await admin
      .from("service_providers")
      .select("id, business_name, phone")
      .eq("id", providerId)
      .maybeSingle();
    if (!provider) return mobileError("Service provider not found", "NOT_FOUND", 404);

    const token = crypto.randomUUID();
    const { error } = await admin
      .from("pm_maintenance_requests")
      .update({
        status: "assigned",
        assigned_provider_id: providerId,
        provider_response_token: token,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (error) throw error;

    const site = getSiteUrl();
    const acceptUrl = `${site}/api/maintenance/respond?id=${requestId}&token=${token}&action=accept`;
    const declineUrl = `${site}/api/maintenance/respond?id=${requestId}&token=${token}&action=decline`;
    const waUrl = buildProviderWhatsAppUrl({
      phone: provider.phone,
      category: request.category,
      description: request.description,
      acceptUrl,
      declineUrl,
    });

    return mobileJson({
      apiVersion: "v1",
      success: true,
      providerWhatsAppUrl: waUrl,
      acceptUrl,
      declineUrl,
      providerName: provider.business_name,
    });
  } catch (err) {
    return mapPmError(err, "mobile pm maintenance assign");
  }
}

type PmAdmin = ReturnType<typeof import("@/lib/pm/access").asPmDb>;

async function assertTenantOwnsCompletedRequest(
  admin: PmAdmin,
  requestId: string,
  userId: string,
): Promise<
  | Response
  | {
      request: {
        id: string;
        status: string;
        tenant_id: string;
        assigned_provider_id: string | null;
      };
    }
> {
  const { data: request } = await admin
    .from("pm_maintenance_requests")
    .select("id, status, tenant_id, assigned_provider_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return mobileError("Request not found", "NOT_FOUND", 404);

  const { data: tenant } = await admin
    .from("pm_tenants")
    .select("id, tenant_user_id, portal_status")
    .eq("id", request.tenant_id)
    .maybeSingle();

  if (tenant?.tenant_user_id !== userId || tenant?.portal_status !== "accepted") {
    return mobileError("Not authorised", "FORBIDDEN", 403);
  }

  if (request.status !== "completed") {
    return mobileError("Only completed requests can be confirmed or reopened", "BAD_REQUEST", 400);
  }

  return {
    request: {
      id: request.id,
      status: request.status,
      tenant_id: request.tenant_id,
      assigned_provider_id: (request.assigned_provider_id as string | null) ?? null,
    },
  };
}

async function confirmMaintenanceResolved(
  admin: PmAdmin,
  requestId: string,
  assignedProviderId: string | null,
): Promise<Response> {
  if (!canTransition("completed", "confirmed")) {
    return mobileError("Invalid transition", "BAD_REQUEST", 400);
  }
  const { error } = await admin
    .from("pm_maintenance_requests")
    .update({ status: "confirmed" })
    .eq("id", requestId);
  if (error) throw error;

  try {
    const { onMaintenanceConfirmed } = await import("@/lib/trust/hooks");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await onMaintenanceConfirmed(supabaseAdmin, {
      requestId,
      assignedProviderId,
    });
  } catch (err) {
    console.warn("[mobile maintenance] trust hook failed", err);
  }

  return mobileJson({ apiVersion: "v1", success: true, status: "confirmed" });
}

async function reopenMaintenanceInProgress(admin: PmAdmin, requestId: string): Promise<Response> {
  if (!canTransition("completed", "in_progress")) {
    return mobileError("Invalid transition", "BAD_REQUEST", 400);
  }
  const { error } = await admin
    .from("pm_maintenance_requests")
    .update({ status: "in_progress", completed_at: null })
    .eq("id", requestId);
  if (error) throw error;

  return mobileJson({ apiVersion: "v1", success: true, status: "in_progress" });
}

async function handleConfirmTenantMaintenance(req: Request, requestId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ resolved?: boolean }>(req);
  if (body instanceof Response) return body;
  if (typeof body.resolved !== "boolean") {
    return mobileError("resolved boolean required", "BAD_REQUEST", 400);
  }

  try {
    const { asPmDb } = await import("@/lib/pm/access");
    const admin = asPmDb(auth.admin);

    const checked = await assertTenantOwnsCompletedRequest(admin, requestId, auth.userId);
    if (checked instanceof Response) return checked;

    if (body.resolved) {
      return confirmMaintenanceResolved(admin, requestId, checked.request.assigned_provider_id);
    }
    return reopenMaintenanceInProgress(admin, requestId);
  } catch (err) {
    return mapPmError(err, "mobile tenant maintenance confirm");
  }
}

type UuidRoute = {
  method: string;
  prefix: string;
  suffix?: string;
  invalidMessage: string;
  handle: (req: Request, id: string) => Promise<Response>;
};

const WAVE16_UUID_ROUTES: readonly UuidRoute[] = [
  {
    method: "PATCH",
    prefix: "/property-management/maintenance/",
    invalidMessage: "Invalid request id",
    handle: handleUpdatePmMaintenanceStatus,
  },
  {
    method: "POST",
    prefix: "/property-management/maintenance/",
    suffix: "/assign",
    invalidMessage: "Invalid request id",
    handle: handleAssignPmMaintenance,
  },
  {
    method: "POST",
    prefix: "/tenants/maintenance/",
    suffix: "/confirm",
    invalidMessage: "Invalid request id",
    handle: handleConfirmTenantMaintenance,
  },
];

/**
 * Wave 16 Mobile BFF — PM maintenance status/assign + tenant confirm.
 */
export async function tryHandleWave16(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  for (const route of WAVE16_UUID_ROUTES) {
    if (route.method !== method) continue;
    const id = matchUuidPath(rest, route.prefix, route.suffix ?? "");
    if (id === undefined) continue;
    if (id === null) return mobileError(route.invalidMessage, "BAD_REQUEST", 400);
    return route.handle(req, id);
  }
  return null;
}
