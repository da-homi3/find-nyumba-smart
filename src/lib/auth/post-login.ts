import { supabase } from "@/integrations/supabase/client";
import { DASHBOARD_APPROVAL_ROLES } from "@/lib/account-roles";
import { clearAuthGateDismiss } from "@/lib/auth/auth-gate";
import { withTimeout } from "@/lib/auth/with-timeout";
import {
  isSafeRedirectPath,
  resolvePostLoginPath,
  type AppRole,
  type PortalId,
} from "@/lib/portal-guard";

type PortalAppRow = { requested_role: string; status: string; created_at?: string };

async function loadRoles(userId: string): Promise<AppRole[]> {
  return withTimeout(
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      return (data ?? []).map((row) => row.role as AppRole);
    })(),
    5_000,
    [] as AppRole[],
  );
}

async function loadActivePortal(userId: string): Promise<PortalId> {
  return withTimeout(
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("active_portal")
        .eq("id", userId)
        .maybeSingle();
      return (data?.active_portal as PortalId | null) ?? "tenant";
    })(),
    3_000,
    "tenant" as PortalId,
  );
}

async function loadPortalApplications(userId: string): Promise<PortalAppRow[]> {
  return withTimeout(
    (async () => {
      const { data } = await supabase
        .from("portal_applications")
        .select("requested_role, status, created_at")
        .eq("user_id", userId);
      return (data ?? []) as PortalAppRow[];
    })(),
    5_000,
    [] as PortalAppRow[],
  );
}

/** Poll until Supabase persists the session (mobile WebViews can lag). */
export async function waitForAuthSession(maxMs = 8_000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return true;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 80));
  }
  return false;
}

export function navigateAfterAuth(path: string): void {
  clearAuthGateDismiss();
  const target = isSafeRedirectPath(path) ? path : "/tenant";
  try {
    globalThis.location.replace(target);
  } catch {
    globalThis.location.href = target;
  }
}

export async function resolveAuthLandingForUser(
  userId: string,
  redirect?: string,
): Promise<string> {
  const [roles, activePortal, apps] = await Promise.all([
    loadRoles(userId),
    loadActivePortal(userId),
    loadPortalApplications(userId),
  ]);

  const hasApprovedDashboardRole = roles.some((role) => DASHBOARD_APPROVAL_ROLES.has(role));
  const hasTenantRole = roles.includes("tenant");
  const hasPendingListerApp = apps.some((app) => app.status === "pending");
  if (hasPendingListerApp && !hasApprovedDashboardRole && !hasTenantRole) {
    return "/auth/pending";
  }

  return resolvePostLoginPath(
    roles,
    activePortal,
    redirect && isSafeRedirectPath(redirect) ? redirect : undefined,
    apps,
  );
}

/** Wait for session persistence, resolve portal landing, then hard-navigate. */
export async function completePostAuthNavigation(opts: {
  userId: string;
  redirect?: string;
}): Promise<void> {
  await waitForAuthSession();
  const path = await resolveAuthLandingForUser(opts.userId, opts.redirect);
  navigateAfterAuth(path);
}
