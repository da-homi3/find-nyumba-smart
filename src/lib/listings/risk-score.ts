import { verificationLevel } from "@/lib/listing-intel";
import type { Property } from "@/lib/properties";

export type RiskLevel = "low" | "medium" | "high";

export type RiskScore = {
  level: RiskLevel;
  reasons: string[];
};

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function neighborhoodMedianRent(
  neighborhood: string,
  listings: Property[],
): number | undefined {
  const rents = listings
    .filter((p) => p.neighborhood === neighborhood && p.rent_kes > 0)
    .map((p) => p.rent_kes);
  return median(rents);
}

export function computeListingRiskScore(
  property: Property,
  neighborhoodMedian?: number,
): RiskScore {
  const reasons: string[] = [];
  let points = 0;

  if (!property.is_verified) {
    points += 2;
    reasons.push("Listing is not NyumbaSearch verified");
  }

  if (verificationLevel(property) < 2) {
    points += 1;
    reasons.push("Landlord verification level is basic or missing");
  }

  const authenticity = property.authenticity_score ?? 70;
  if (authenticity < 60) {
    points += 2;
    reasons.push("Low authenticity score on photos and listing details");
  }

  if (!property.address?.trim()) {
    points += 1;
    reasons.push("No street address provided on the listing");
  }

  if (neighborhoodMedian && property.rent_kes < neighborhoodMedian * 0.65) {
    points += 2;
    reasons.push("Rent is well below typical for this neighbourhood");
  }

  if (!property.images?.length) {
    points += 1;
    reasons.push("No listing photos uploaded");
  }

  const daysListed = Math.floor(
    (Date.now() - new Date(property.created_at).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysListed < 1) {
    points += 1;
    reasons.push("Brand-new listing with limited track record");
  }

  let level: RiskLevel = "low";
  if (points >= 5) level = "high";
  else if (points >= 2) level = "medium";

  if (reasons.length === 0) {
    reasons.push("Verified landlord, consistent pricing, and complete listing details");
  }

  return { level, reasons: reasons.slice(0, 4) };
}
