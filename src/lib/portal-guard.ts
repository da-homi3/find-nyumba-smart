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

export function canAccessPortal(roles: AppRole[], portal: PortalId): boolean {
  if (portal === "tenant") return true;
  if (portal === "caretaker") return true;
  const required = PORTAL_REQUIRED_ROLE[portal];
  return required ? roles.includes(required) : false;
}

export function resolvePostLoginPath(
  roles: AppRole[],
  activePortal: PortalId | null,
  redirect?: string,
): string {
  if (redirect) return redirect;
  if (activePortal && canAccessPortal(roles, activePortal)) {
    return PORTAL_HOME[activePortal];
  }
  if (roles.includes("landlord")) return PORTAL_HOME.landlord;
  if (roles.includes("agency")) return PORTAL_HOME.agency;
  if (roles.includes("manager")) return PORTAL_HOME.manager;
  if (roles.includes("admin")) return PORTAL_HOME.admin;
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
