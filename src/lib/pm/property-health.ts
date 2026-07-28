/**
 * Property health score — portfolio signal for landlords (not the marketplace
 * review-based `properties.health_score`).
 *
 * Factors are computed in-process and returned with the dashboard; they are
 * landlord-facing, not a public punitive label.
 */

export type PropertyHealthInput = {
  /** 0–100 */
  occupancyRate: number;
  expectedIncomeKes: number;
  collectedThisMonthKes: number;
  totalUnits: number;
  vacantUnits: number;
  openMaintenanceRequests: number;
  /** Average days from created_at → completed_at for recent closed jobs; null if none. */
  avgMaintenanceDays: number | null;
};

export type PropertyHealthFactor = {
  key: string;
  label: string;
  contribution: number;
};

export type PropertyHealthResult = {
  score: number;
  collectionRate: number;
  factors: PropertyHealthFactor[];
  label: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function collectionRatePercent(expected: number, collected: number): number {
  if (expected <= 0) return 100;
  return clamp(Math.round((collected / expected) * 100), 0, 100);
}

export function computePropertyHealthScore(input: PropertyHealthInput): PropertyHealthResult {
  const collectionRate = collectionRatePercent(
    input.expectedIncomeKes,
    input.collectedThisMonthKes,
  );
  const vacantShare =
    input.totalUnits > 0
      ? clamp(Math.round((input.vacantUnits / input.totalUnits) * 100), 0, 100)
      : 0;
  const openPerTen =
    input.totalUnits > 0 ? (input.openMaintenanceRequests / input.totalUnits) * 10 : 0;

  // Start neutral; add weighted contributions (same spirit as reputation factors).
  let score = 50;
  const factors: PropertyHealthFactor[] = [];

  const occContrib = Math.round((input.occupancyRate - 50) * 0.35);
  score += occContrib;
  factors.push({
    key: "occupancy",
    label: "Occupancy",
    contribution: occContrib,
  });

  const collContrib = Math.round((collectionRate - 50) * 0.35);
  score += collContrib;
  factors.push({
    key: "collection",
    label: "Rent collection",
    contribution: collContrib,
  });

  let maintContrib = 0;
  if (input.openMaintenanceRequests === 0) {
    maintContrib += 8;
  } else {
    maintContrib -= Math.min(20, Math.round(openPerTen * 4));
  }
  if (input.avgMaintenanceDays != null) {
    if (input.avgMaintenanceDays <= 3) maintContrib += 6;
    else if (input.avgMaintenanceDays <= 7) maintContrib += 2;
    else if (input.avgMaintenanceDays > 14) maintContrib -= 8;
  }
  score += maintContrib;
  factors.push({
    key: "maintenance",
    label: "Maintenance responsiveness",
    contribution: maintContrib,
  });

  const vacContrib = Math.round((50 - vacantShare) * 0.15);
  score += vacContrib;
  factors.push({
    key: "vacancy",
    label: "Vacancy pressure",
    contribution: vacContrib,
  });

  score = clamp(Math.round(score), 0, 100);

  let label = "Needs attention";
  if (score >= 85) label = "Excellent";
  else if (score >= 70) label = "Healthy";
  else if (score >= 55) label = "Stable";
  else if (score >= 40) label = "Watch closely";

  return { score, collectionRate, factors, label };
}
