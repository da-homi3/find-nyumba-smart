import { TENANT_MAX_RENT } from "@/lib/tenant-filter-defaults";

export function formatRentBudget(value: number): string {
  if (value >= TENANT_MAX_RENT) return "59M+";
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
  }
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString("en-KE");
}

export function isOpenEndedRentBudget(maxRent: number): boolean {
  return maxRent >= TENANT_MAX_RENT;
}
