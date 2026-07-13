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

export type ListerRole = "landlord" | "manager" | "agency";

const LISTER_ROLES = new Set<AppRole>(["landlord", "manager", "agency"]);

export function listerDashboardPath(role: ListerRole): string {
  return PORTAL_HOME[role];
}

export function resolveListerDashboardPath(input: {
  roles: AppRole[];
  activePortal?: PortalId | null;
  applications?: ReadonlyArray<{ requested_role: string; status: string; created_at?: string }>;
}): string {
  const roleSet = new Set(input.roles);

  if (
    input.activePortal &&
    LISTER_ROLES.has(input.activePortal as AppRole) &&
    roleSet.has(input.activePortal as AppRole)
  ) {
    return PORTAL_HOME[input.activePortal];
  }

  const approvedListerApp = [...(input.applications ?? [])]
    .filter(
      (app) =>
        app.status === "approved" &&
        (app.requested_role === "landlord" ||
          app.requested_role === "manager" ||
          app.requested_role === "agency"),
    )
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];

  if (approvedListerApp) {
    return listerDashboardPath(approvedListerApp.requested_role as ListerRole);
  }

  const matched = POST_LOGIN_ROLE_PRIORITY.find(
    (role) => roleSet.has(role) && LISTER_ROLES.has(role),
  );
  if (matched) return PORTAL_HOME[matched as PortalId];

  return PORTAL_HOME.tenant;
}

export function canAccessPortal(roles: AppRole[], portal: PortalId): boolean {
  if (portal === "tenant") return true;
  if (portal === "caretaker") return true;
  const required = PORTAL_REQUIRED_ROLE[portal];
  return required ? new Set(roles).has(required) : false;
}

export function hasPendingApplicationForRole(
  applications: ReadonlyArray<{ requested_role: string; status: string }>,
  role: ListerRole,
): boolean {
  return applications.some((a) => a.requested_role === role && a.status === "pending");
}

export function isSafeRedirectPath(path: string | undefined): path is string {
  if (!path || typeof path !== "string") return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  if (/^\/https?:/i.test(path)) return false;
  return true;
}

export function resolvePostLoginPath(
  roles: AppRole[],
  activePortal: PortalId | null,
  redirect?: string,
  applications?: ReadonlyArray<{ requested_role: string; status: string; created_at?: string }>,
): string {
  if (redirect && isSafeRedirectPath(redirect)) {
    const portal = portalFromPathname(redirect);
    if (!portal || portal === "tenant" || canAccessPortal(roles, portal)) {
      return redirect;
    }
  }

  const roleSet = new Set(roles);
  if ([...LISTER_ROLES].some((role) => roleSet.has(role))) {
    return resolveListerDashboardPath({ roles, activePortal, applications });
  }

  if (activePortal && canAccessPortal(roles, activePortal)) {
    return PORTAL_HOME[activePortal];
  }
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
