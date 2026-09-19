export type AccountRole =
  | "tenant"
  | "landlord"
  | "manager"
  | "agency"
  | "property_developer"
  | "agent";

export const PRIVILEGED_ACCOUNT_ROLES = new Set<AccountRole>([
  "landlord",
  "manager",
  "agency",
  "property_developer",
  "agent",
]);

export const ORG_REQUIRED_ROLES = new Set<AccountRole>([
  "landlord",
  "manager",
  "agency",
  "property_developer",
  "agent",
]);

export function organizationFieldLabel(role: AccountRole): string {
  if (role === "landlord") return "Portfolio or business name";
  if (role === "property_developer") return "Developer company name";
  if (role === "agent") return "Agency or trading name";
  return "Organization name";
}

export function organizationFieldPlaceholder(role: AccountRole): string {
  if (role === "landlord") return "e.g. Westlands Apartments or Jane Doe Properties";
  if (role === "property_developer") return "e.g. Skyline Homes Ltd";
  if (role === "agent") return "e.g. Jane Wanjiku Properties";
  return "e.g. Nairobi Homes Ltd";
}

export const DASHBOARD_APPROVAL_ROLES = new Set<string>([
  "landlord",
  "manager",
  "agency",
  "property_developer",
  "agent",
  "admin",
]);

export function isPrivilegedAccountRole(role: AccountRole): boolean {
  return PRIVILEGED_ACCOUNT_ROLES.has(role);
}
