import { mobileError, mobileJson } from "@/lib/api/mobile/v1/auth";
import {
  mapAuthzError,
  requireListerMobile,
  requireTenantMobile,
} from "@/lib/api/mobile/v1/guards";
import { parseJsonBody, parseUuid } from "@/lib/api/mobile/v1/helpers";
import {
  listLandlordApplications,
  listTenantApplications,
  reviewRentalApplication,
  submitRentalApplication,
  withdrawRentalApplication,
} from "@/lib/rental-applications/core";
import { loadTenantProfileBundle } from "@/lib/tenant/profile-bundle";

async function handleTenantProfile(req: Request): Promise<Response> {
  const auth = await requireTenantMobile(req);
  if (auth instanceof Response) return auth;
  try {
    const bundle = await loadTenantProfileBundle(auth.admin, auth.userId);
    return mobileJson({ apiVersion: "v1", ...bundle });
  } catch (err) {
    console.error("[wave23] tenant profile", err);
    return mobileError("Could not load tenant profile", "PROFILE_ERROR", 500);
  }
}

async function handleTenantApplications(req: Request): Promise<Response> {
  const auth = await requireTenantMobile(req);
  if (auth instanceof Response) return auth;
  try {
    const applications = await listTenantApplications(auth.admin, auth.userId);
    return mobileJson({ apiVersion: "v1", applications });
  } catch (err) {
    console.error("[wave23] list applications", err);
    return mobileError("Could not load applications", "APPLICATION_ERROR", 500);
  }
}

async function handleApplicationSubmit(req: Request): Promise<Response> {
  const auth = await requireTenantMobile(req);
  if (auth instanceof Response) return auth;
  const body = await parseJsonBody<{
    propertyId?: string;
    message?: string;
    moveInDate?: string;
    shareProfile?: boolean;
  }>(req);
  if (body instanceof Response) return body;
  const propertyId = parseUuid(body.propertyId);
  if (!propertyId) return mobileError("propertyId required", "VALIDATION", 400);
  try {
    const application = await submitRentalApplication(auth.admin, auth.userId, {
      propertyId,
      message: body.message,
      moveInDate: body.moveInDate,
      shareProfile: body.shareProfile,
    });
    return mobileJson({ apiVersion: "v1", application }, 201);
  } catch (err) {
    return mapAuthzError(err, "Could not submit application", "APPLICATION_ERROR");
  }
}

async function handleApplicationWithdraw(req: Request, rawId: string): Promise<Response> {
  const auth = await requireTenantMobile(req);
  if (auth instanceof Response) return auth;
  const applicationId = parseUuid(rawId);
  if (!applicationId) return mobileError("Invalid application id", "VALIDATION", 400);
  try {
    const application = await withdrawRentalApplication(auth.admin, auth.userId, applicationId);
    return mobileJson({ apiVersion: "v1", application });
  } catch (err) {
    return mapAuthzError(err, "Could not withdraw application", "APPLICATION_ERROR");
  }
}

async function handleLandlordApplications(req: Request): Promise<Response> {
  const auth = await requireListerMobile(req);
  if (auth instanceof Response) return auth;
  try {
    const applications = await listLandlordApplications(auth.admin, auth.userId);
    return mobileJson({ apiVersion: "v1", applications });
  } catch (err) {
    console.error("[wave23] landlord applications", err);
    return mobileError("Could not load applications", "APPLICATION_ERROR", 500);
  }
}

async function handleApplicationReview(req: Request, rawId: string): Promise<Response> {
  const auth = await requireListerMobile(req);
  if (auth instanceof Response) return auth;
  const applicationId = parseUuid(rawId);
  if (!applicationId) return mobileError("Invalid application id", "VALIDATION", 400);
  const body = await parseJsonBody<{ status?: string; landlordNotes?: string }>(req);
  if (body instanceof Response) return body;
  if (body.status !== "under_review" && body.status !== "approved" && body.status !== "rejected") {
    return mobileError("Invalid status", "VALIDATION", 400);
  }
  try {
    const application = await reviewRentalApplication(auth.admin, auth.userId, {
      applicationId,
      status: body.status,
      landlordNotes: body.landlordNotes,
    });
    return mobileJson({ apiVersion: "v1", application });
  } catch (err) {
    return mapAuthzError(err, "Could not review application", "APPLICATION_ERROR");
  }
}

export async function tryHandleWave23(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const upper = method.toUpperCase();

  if (rest === "/tenant/profile" && upper === "GET") {
    return handleTenantProfile(req);
  }

  if (rest === "/tenant/applications" && upper === "GET") {
    return handleTenantApplications(req);
  }

  if (rest === "/applications" && upper === "POST") {
    return handleApplicationSubmit(req);
  }

  const withdrawMatch = /^\/applications\/([^/]+)\/withdraw$/.exec(rest);
  if (withdrawMatch && upper === "POST") {
    return handleApplicationWithdraw(req, withdrawMatch[1]);
  }

  if (rest === "/landlord/applications" && upper === "GET") {
    return handleLandlordApplications(req);
  }

  const reviewMatch = /^\/landlord\/applications\/([^/]+)\/review$/.exec(rest);
  if (reviewMatch && upper === "POST") {
    return handleApplicationReview(req, reviewMatch[1]);
  }

  return null;
}
