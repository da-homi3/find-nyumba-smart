import type { AppRole, PortalId, ListerRole } from "@/lib/portal-guard";
import { hasPendingApplicationForRole, isSafeRedirectPath } from "@/lib/portal-guard";

export type GuardPortal = Exclude<PortalId, "tenant">;

export type PortalAccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      redirectTo: string;
      redirectSearch?: Record<string, string | undefined>;
    };

const LISTER_PORTALS = new Set<GuardPortal>([
  "landlord",
  "manager",
  "agency",
  "property_developer",
  "agent",
]);

/** Marketing / signup entry points — no session required. */
export const PORTAL_PUBLIC_ENTRY: Partial<Record<GuardPortal, readonly string[]>> = {
  landlord: ["/landlord", "/landlord/"],
  manager: ["/manager", "/manager/"],
  agency: ["/agency", "/agency/"],
  property_developer: ["/developer", "/developer/"],
  agent: ["/agent", "/agent/"],
  caretaker: ["/caretaker", "/caretaker/"],
};

/** Authenticated users without the portal role may access these (checkout flows). */
export const PORTAL_AUTH_ONLY_PREFIXES: Partial<Record<GuardPortal, readonly string[]>> = {
  landlord: ["/landlord/checkout", "/landlord/boost", "/landlord/dashboard/plan"],
  manager: ["/manager/checkout"],
  agency: ["/agency/checkout"],
  property_developer: ["/developer/checkout"],
  agent: ["/agent/checkout"],
};

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname || "/";
}

export function isPortalPublicEntry(portal: GuardPortal, pathname: string): boolean {
  const path = normalizePath(pathname);
  return (PORTAL_PUBLIC_ENTRY[portal] ?? []).some((entry) => normalizePath(entry) === path);
}

export function isPortalAuthOnlyPath(portal: GuardPortal, pathname: string): boolean {
  const path = normalizePath(pathname);
  return (PORTAL_AUTH_ONLY_PREFIXES[portal] ?? []).some(
    (prefix) => path === normalizePath(prefix) || path.startsWith(`${normalizePath(prefix)}/`),
  );
}

export function portalRequiredRole(portal: GuardPortal): AppRole | null {
  if (portal === "caretaker") return "caretaker";
  if (portal === "admin") return "admin";
  if (LISTER_PORTALS.has(portal)) return portal as AppRole;
  return null;
}

export function userHasPortalRole(roles: ReadonlySet<AppRole>, portal: GuardPortal): boolean {
  if (roles.has("admin")) return true;
  const required = portalRequiredRole(portal);
  return required ? roles.has(required) : false;
}

export function evaluatePortalAccess(input: {
  portal: GuardPortal;
  pathname: string;
  roles: ReadonlySet<AppRole>;
  userId: string | null;
  pendingApplications?: ReadonlyArray<{ requested_role: string; status: string }>;
}): PortalAccessDecision {
  const path = normalizePath(input.pathname);

  if (isPortalPublicEntry(input.portal, path)) {
    return { allowed: true };
  }

  // Caretaker uses phone+PIN tokens (not Supabase roles). Dashboard validates PIN client-side
  // and redirects to /caretaker when the session is missing/invalid. Phone-OTP identity is future work.
  if (input.portal === "caretaker") {
    return { allowed: true };
  }

  if (!input.userId) {
    return {
      allowed: false,
      redirectTo: "/auth",
      redirectSearch: {
        redirect: isSafeRedirectPath(path) ? path : undefined,
        mode: "signin",
        signupFor: LISTER_PORTALS.has(input.portal) ? input.portal : undefined,
      },
    };
  }

  if (isPortalAuthOnlyPath(input.portal, path)) {
    return { allowed: true };
  }

  if (userHasPortalRole(input.roles, input.portal)) {
    return { allowed: true };
  }

  if (LISTER_PORTALS.has(input.portal)) {
    const listerRole = input.portal as ListerRole;
    const pending = hasPendingApplicationForRole(input.pendingApplications ?? [], listerRole);
    if (pending) {
      return { allowed: false, redirectTo: "/auth/pending" };
    }
    return {
      allowed: false,
      redirectTo: "/auth",
      redirectSearch: {
        redirect: isSafeRedirectPath(path) ? path : undefined,
        signupFor: input.portal,
        mode: "signup",
      },
    };
  }

  return { allowed: false, redirectTo: "/auth", redirectSearch: { redirect: path } };
}

export function portalFromPathname(pathname: string): GuardPortal | null {
  const path = normalizePath(pathname);
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if (path === "/landlord" || path.startsWith("/landlord/")) return "landlord";
  if (path === "/manager" || path.startsWith("/manager/")) return "manager";
  if (path === "/agency" || path.startsWith("/agency/")) return "agency";
  if (path === "/developer" || path.startsWith("/developer/")) return "property_developer";
  if (path === "/agent" || path.startsWith("/agent/")) return "agent";
  if (path === "/caretaker" || path.startsWith("/caretaker/")) return "caretaker";
  return null;
}
