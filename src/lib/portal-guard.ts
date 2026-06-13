export type PortalId = "tenant" | "landlord" | "manager" | "agency" | "caretaker" | "admin";

export type AppRole = "tenant" | "landlord" | "manager" | "agency" | "caretaker" | "admin";

export const PORTAL_HOME: Record<PortalId, string> = {
  tenant: "/tenant",
  landlord: "/landlord/dashboard",
  manager: "/manager/dashboard",
  agency: "/agency/dashboard",
  caretaker: "/caretaker/dashboard",
  admin: "/admin",
};

export const PORTAL_REQUIRED_ROLE: Partial<Record<PortalId, AppRole>> = {
  landlord: "landlord",
  manager: "manager",
  agency: "agency",
  admin: "admin",
};

export function portalForRole(role: AppRole): PortalId | null {
  if (role === "tenant") return "tenant";
  if (role === "landlord") return "landlord";
  if (role === "manager") return "manager";
  if (role === "agency") return "agency";
  if (role === "admin") return "admin";
  return null;
}

const POST_LOGIN_ROLE_PRIORITY: AppRole[] = ["landlord", "agency", "manager", "admin"];

export function canAccessPortal(roles: AppRole[], portal: PortalId): boolean {
  if (portal === "tenant") return true;
  if (portal === "caretaker") return true;
  const required = PORTAL_REQUIRED_ROLE[portal];
  return required ? new Set(roles).has(required) : false;
}

export function hasPendingApplicationForRole(
  applications: ReadonlyArray<{ requested_role: string; status: string }>,
  role: "landlord" | "manager" | "agency",
): boolean {
  return applications.some((a) => a.requested_role === role && a.status === "pending");
}

export function resolvePostLoginPath(
  roles: AppRole[],
  activePortal: PortalId | null,
  redirect?: string,
): string {
  if (redirect) {
    const portal = portalFromPathname(redirect);
    if (!portal || portal === "tenant" || canAccessPortal(roles, portal)) {
      return redirect;
    }
  }
  if (activePortal && canAccessPortal(roles, activePortal)) {
    return PORTAL_HOME[activePortal];
  }
  const roleSet = new Set(roles);
  const matched = POST_LOGIN_ROLE_PRIORITY.find((role) => roleSet.has(role));
  if (matched) return PORTAL_HOME[matched];
  return PORTAL_HOME.tenant;
}

export function portalFromPathname(pathname: string): PortalId | null {
  if (pathname.startsWith("/landlord")) return "landlord";
  if (pathname.startsWith("/manager")) return "manager";
  if (pathname.startsWith("/agency")) return "agency";
  if (pathname.startsWith("/caretaker")) return "caretaker";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/tenant")) return "tenant";
  return null;
}
