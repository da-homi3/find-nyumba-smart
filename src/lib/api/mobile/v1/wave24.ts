import { mobileError, mobileJson, requireMobileBearer } from "@/lib/api/mobile/v1/auth";
import {
  mapAuthzError,
  requireListerMobile,
  requireTenantMobile,
} from "@/lib/api/mobile/v1/guards";
import { parseJsonBody, parseUuid } from "@/lib/api/mobile/v1/helpers";
import {
  bookViewingCore,
  listLandlordViewings,
  listTenantViewings,
  updateViewingStatusCore,
  type ViewingStatus,
} from "@/lib/viewings/core";

function parseViewingStatus(value: string | undefined): ViewingStatus | null {
  if (
    value === "pending" ||
    value === "confirmed" ||
    value === "cancelled" ||
    value === "completed"
  ) {
    return value;
  }
  return null;
}

export async function tryHandleWave24(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const upper = method.toUpperCase();

  if (rest === "/tenant/viewings" && upper === "GET") {
    const auth = await requireTenantMobile(req);
    if (auth instanceof Response) return auth;
    try {
      const viewings = await listTenantViewings(auth.admin, auth.userId);
      return mobileJson({ apiVersion: "v1", viewings });
    } catch (err) {
      console.error("[wave24] tenant viewings", err);
      return mobileError("Could not load viewings", "VIEWING_ERROR", 500);
    }
  }

  if (rest === "/landlord/viewings" && upper === "GET") {
    const auth = await requireListerMobile(req);
    if (auth instanceof Response) return auth;
    try {
      const viewings = await listLandlordViewings(auth.admin, auth.userId);
      return mobileJson({ apiVersion: "v1", viewings });
    } catch (err) {
      console.error("[wave24] landlord viewings", err);
      return mobileError("Could not load viewings", "VIEWING_ERROR", 500);
    }
  }

  if (rest === "/viewings" && upper === "POST") {
    const auth = await requireTenantMobile(req);
    if (auth instanceof Response) return auth;
    const body = await parseJsonBody<{
      propertyId?: string;
      scheduledAt?: string;
      notes?: string;
    }>(req);
    if (body instanceof Response) return body;
    const propertyId = parseUuid(body.propertyId);
    if (!propertyId) return mobileError("propertyId required", "VALIDATION", 400);
    if (!body.scheduledAt?.trim()) {
      return mobileError("scheduledAt required", "VALIDATION", 400);
    }
    try {
      const viewing = await bookViewingCore(auth.admin, auth.userId, {
        propertyId,
        scheduledAt: body.scheduledAt.trim(),
        notes: body.notes,
      });
      return mobileJson({ apiVersion: "v1", viewing }, 201);
    } catch (err) {
      return mapAuthzError(err, "Could not book viewing", "VIEWING_ERROR");
    }
  }

  const statusMatch = /^\/viewings\/([^/]+)\/status$/.exec(rest);
  if (statusMatch && upper === "POST") {
    const auth = await requireMobileBearer(req);
    if (auth instanceof Response) return auth;
    const viewingId = parseUuid(statusMatch[1]);
    if (!viewingId) return mobileError("Invalid viewing id", "VALIDATION", 400);
    const body = await parseJsonBody<{ status?: string }>(req);
    if (body instanceof Response) return body;
    const status = parseViewingStatus(body.status);
    if (!status) return mobileError("Invalid status", "VALIDATION", 400);
    try {
      const viewing = await updateViewingStatusCore(auth.admin, auth.userId, {
        viewingId,
        status,
      });
      return mobileJson({ apiVersion: "v1", viewing });
    } catch (err) {
      return mapAuthzError(err, "Could not update viewing", "VIEWING_ERROR");
    }
  }

  return null;
}
