import { ForbiddenError, requireRole } from "@/lib/api/_authz";
import {
  mobileError,
  requireMobileBearer,
  userHasRole,
  type MobileAdmin,
} from "@/lib/api/mobile/v1/auth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export async function requireTenantMobile(req: Request) {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  try {
    await requireRole(auth.admin, auth.userId, "tenant");
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return mobileError(err.message, "FORBIDDEN", 403);
    }
    throw err;
  }
  return auth;
}

export async function requireListerMobile(req: Request) {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await assertListerRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;
  return auth;
}

export async function assertListerRole(
  admin: MobileAdmin,
  userId: string,
): Promise<Response | null> {
  try {
    await requireRole(admin, userId, [
      "landlord",
      "manager",
      "agency",
      "property_developer",
      "agent",
    ]);
    return null;
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return mobileError(err.message, "FORBIDDEN", 403);
    }
    throw err;
  }
}

export async function requireAgencyOrManagerMobile(req: Request) {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await assertAgencyOrManagerRole(auth.admin, auth.userId);
  if (roleErr) return roleErr;
  return auth;
}

export async function assertAgencyOrManagerRole(
  admin: MobileAdmin,
  userId: string,
): Promise<Response | null> {
  const [agency, manager, developer, agent, adminRole] = await Promise.all([
    userHasRole(admin, userId, "agency"),
    userHasRole(admin, userId, "manager"),
    userHasRole(admin, userId, "property_developer"),
    userHasRole(admin, userId, "agent"),
    userHasRole(admin, userId, "admin"),
  ]);
  if (!agency && !manager && !developer && !agent && !adminRole) {
    return mobileError("Agency, developer, agent, or manager role required", "FORBIDDEN", 403);
  }
  return null;
}

/** Landlord, agency, manager, or admin — for PM / portal maintenance routes. */
export async function requirePortalListerMobile(req: Request) {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roles: AppRole[] = [
    "landlord",
    "agency",
    "manager",
    "property_developer",
    "agent",
    "admin",
  ];
  for (const role of roles) {
    if (await userHasRole(auth.admin, auth.userId, role)) return auth;
  }
  return mobileError("Portal role required", "FORBIDDEN", 403);
}

export async function assertPortalListerRole(
  admin: MobileAdmin,
  userId: string,
): Promise<Response | null> {
  const roles: AppRole[] = [
    "landlord",
    "agency",
    "manager",
    "property_developer",
    "agent",
    "admin",
  ];
  for (const role of roles) {
    if (await userHasRole(admin, userId, role)) return null;
  }
  return mobileError("Portal role required", "FORBIDDEN", 403);
}

export function mapAuthzError(err: unknown, fallback: string, code = "REQUEST_ERROR"): Response {
  if (err instanceof ForbiddenError) {
    return mobileError(err.message, "FORBIDDEN", 403);
  }
  const message = err instanceof Error ? err.message : fallback;
  return mobileError(message, code, 400);
}
