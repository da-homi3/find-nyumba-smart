export type RentalApplicationStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "withdrawn";

export const ACTIVE_RENTAL_APPLICATION_STATUSES = new Set<RentalApplicationStatus>([
  "submitted",
  "under_review",
  "approved",
]);

export const WITHDRAWABLE_RENTAL_APPLICATION_STATUSES = ACTIVE_RENTAL_APPLICATION_STATUSES;

export function isActiveRentalApplicationStatus(status: string): status is RentalApplicationStatus {
  return ACTIVE_RENTAL_APPLICATION_STATUSES.has(status as RentalApplicationStatus);
}

export function canWithdrawRentalApplication(status: string): boolean {
  return WITHDRAWABLE_RENTAL_APPLICATION_STATUSES.has(status as RentalApplicationStatus);
}

export function formatRentalApplicationStatus(status: string): string {
  return status.replaceAll("_", " ");
}
