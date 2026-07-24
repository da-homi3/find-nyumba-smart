/** Maintenance request lifecycle — Phase 3. */

export const MAINTENANCE_STATUSES = [
  "reported",
  "assigned",
  "accepted",
  "in_progress",
  "completed",
  "confirmed",
] as const;

export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_CATEGORIES = [
  "plumbing",
  "electrical",
  "security",
  "internet",
  "cleaning",
  "water",
  "structural",
  "other",
] as const;

export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number];

export const MAINTENANCE_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number];

export const VALID_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  reported: ["assigned", "in_progress"],
  assigned: ["accepted", "reported"],
  accepted: ["in_progress"],
  in_progress: ["completed"],
  completed: ["confirmed", "in_progress"],
  confirmed: [],
};

export function canTransition(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from as MaintenanceStatus];
  return allowed?.includes(to as MaintenanceStatus) ?? false;
}

/** Map maintenance category → service_providers.categories slug. */
export const MAINTENANCE_TO_PROVIDER_CATEGORY: Record<MaintenanceCategory, string> = {
  plumbing: "plumbers",
  electrical: "electricians",
  security: "security",
  internet: "internet",
  cleaning: "cleaning",
  water: "water_services",
  structural: "carpentry",
  other: "appliance_repair",
};

export function providerCategoryForMaintenance(category: string): string {
  return MAINTENANCE_TO_PROVIDER_CATEGORY[category as MaintenanceCategory] ?? "appliance_repair";
}

export const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  reported: "New",
  assigned: "Assigned",
  accepted: "Provider confirmed",
  in_progress: "In progress",
  completed: "Awaiting tenant confirmation",
  confirmed: "Resolved",
};
