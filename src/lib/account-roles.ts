export type AccountRole = "tenant" | "landlord" | "manager" | "agency";

export const PRIVILEGED_ACCOUNT_ROLES = new Set<AccountRole>(["landlord", "manager", "agency"]);

export const ORG_REQUIRED_ROLES = new Set<AccountRole>(["agency", "manager"]);

export const DASHBOARD_APPROVAL_ROLES = new Set<string>(["landlord", "manager", "agency", "admin"]);

export function isPrivilegedAccountRole(role: AccountRole): boolean {
  return PRIVILEGED_ACCOUNT_ROLES.has(role);
}
