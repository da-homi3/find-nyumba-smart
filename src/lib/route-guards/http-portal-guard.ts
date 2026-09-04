import {
  evaluatePortalAccess,
  portalFromPathname,
  type GuardPortal,
} from "@/lib/route-guards/portal-access";
import {
  extractRequestAccessToken,
  resolveRequestUserId,
} from "@/lib/route-guards/request-session";
import type { AppRole } from "@/lib/portal-guard";

async function loadRolesForUser(userId: string): Promise<Set<AppRole>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  const roles = new Set<AppRole>();
  for (const row of data ?? []) {
    roles.add(row.role as AppRole);
  }
  return roles;
}

async function loadPendingApplications(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("portal_applications")
    .select("requested_role, status")
    .eq("user_id", userId)
    .eq("status", "pending");
  return data ?? [];
}

function redirectResponse(url: URL): Response {
  return Response.redirect(url.toString(), 302);
}

/**
 * When a signed-in session cookie is present, block SSR of portal pages
 * for users who lack the required role.
 */
export async function maybePortalRouteRedirect(request: Request): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const pathname = new URL(request.url).pathname;
  const portal = portalFromPathname(pathname);
  if (!portal) return null;

  const token = extractRequestAccessToken(request);
  if (!token) return null;

  const userId = await resolveRequestUserId(request);
  if (!userId) return null;

  const [roles, pendingApplications] = await Promise.all([
    loadRolesForUser(userId),
    loadPendingApplications(userId),
  ]);

  const decision = evaluatePortalAccess({
    portal: portal as GuardPortal,
    pathname,
    roles,
    userId,
    pendingApplications,
  });

  if (decision.allowed) return null;

  const url = new URL(request.url);
  url.pathname = decision.redirectTo;
  url.search = "";
  for (const [key, value] of Object.entries(decision.redirectSearch ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return redirectResponse(url);
}
