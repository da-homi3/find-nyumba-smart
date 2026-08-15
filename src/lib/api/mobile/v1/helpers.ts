import type { Database } from "@/integrations/supabase/types";
import {
  mobileError,
  requireMobileBearer,
  userHasRole,
  type MobileAdmin,
} from "@/lib/api/mobile/v1/auth";
import { ForbiddenError } from "@/lib/api/_authz";
import { PmModuleRequiredError } from "@/lib/pm/module-gate";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AppRole = Database["public"]["Enums"]["app_role"];

export function parseUuid(value: string | undefined): string | null {
  if (!value || !UUID_RE.test(value)) return null;
  return value;
}

export async function parseJsonBody<T>(req: Request): Promise<T | Response> {
  try {
    const text = await req.text();
    if (!text.trim()) return {} as T;
    return JSON.parse(text) as T;
  } catch {
    return mobileError("Invalid JSON", "BAD_REQUEST", 400);
  }
}

export function mapPmError(err: unknown, logLabel = "mobile pm"): Response {
  if (err instanceof PmModuleRequiredError) {
    return mobileError(err.message, err.code, err.status);
  }
  if (err instanceof ForbiddenError) {
    return mobileError(err.message, "FORBIDDEN", 403);
  }
  const status = (err as { status?: number } | null)?.status;
  if (status === 404) {
    return mobileError("Property not found", "NOT_FOUND", 404);
  }
  const message = err instanceof Error ? err.message : "Property management error";
  console.error(`${logLabel}:`, message);
  return mobileError(message, "PM_ERROR", 500);
}

export async function requireAdmin(
  req: Request,
): Promise<{ admin: MobileAdmin; userId: string } | Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  if (!(await userHasRole(auth.admin, auth.userId, "admin" as AppRole))) {
    return mobileError("Admin role required", "FORBIDDEN", 403);
  }
  return { admin: auth.admin, userId: auth.userId };
}
