export type AccountRole = "tenant" | "landlord" | "manager" | "agency";

export const PRIVILEGED_ACCOUNT_ROLES = new Set<AccountRole>(["landlord", "manager", "agency"]);

export const ORG_REQUIRED_ROLES = new Set<AccountRole>(["landlord", "manager", "agency"]);

export function organizationFieldLabel(role: AccountRole): string {
  if (role === "landlord") return "Portfolio or business name";
  return "Organization name";
}

export function organizationFieldPlaceholder(role: AccountRole): string {
  if (role === "landlord") return "e.g. Westlands Apartments or Jane Doe Properties";
  return "e.g. Nairobi Homes Ltd";
}

export const DASHBOARD_APPROVAL_ROLES = new Set<string>(["landlord", "manager", "agency", "admin"]);

export function isPrivilegedAccountRole(role: AccountRole): boolean {
  return PRIVILEGED_ACCOUNT_ROLES.has(role);
}
