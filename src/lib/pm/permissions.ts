export type PmStaffRole =
  | "owner"
  | "property_manager"
  | "caretaker"
  | "security"
  | "accountant"
  | "maintenance_supervisor"
  | "reception";

const STAFF_PERMISSIONS: Record<PmStaffRole, string[]> = {
  owner: ["*"],
  property_manager: [
    "units:*",
    "tenants:*",
    "leases:*",
    "invoices:*",
    "payments:*",
    "maintenance:*",
    "complaints:*",
    "notices:create",
    "staff:view",
  ],
  caretaker: ["maintenance:*", "complaints:view", "units:view", "tenants:view"],
  security: ["visitors:*", "units:view"],
  accountant: ["invoices:*", "payments:*", "units:view", "tenants:view"],
  maintenance_supervisor: ["maintenance:*", "units:view"],
  reception: ["tenants:view", "notices:view", "visitors:create", "complaints:view"],
};

export function staffCan(staffRole: string, permission: string): boolean {
  const perms = STAFF_PERMISSIONS[staffRole as PmStaffRole] ?? [];
  if (perms.includes("*")) return true;
  const [resource] = permission.split(":");
  return perms.includes(permission) || perms.includes(`${resource}:*`);
}
