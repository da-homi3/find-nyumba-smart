import { formatKes } from "@/lib/properties";
import {
  isCommercialType,
  listingPriceSuffix,
  type PricePeriod,
  type PricingMode,
  type PropertyType,
} from "@/lib/property-types";

export type CommercialRangeInput = {
  property_type: PropertyType;
  rent_kes: number;
  rent_kes_max?: number | null;
  area_sqm?: number | null;
  area_sqm_max?: number | null;
  pricing_mode?: PricingMode | null;
  price_period?: PricePeriod | null;
};

/** Commercial listings and for-sale listings may use a from–to price. */
export function supportsListingPriceRange(input: {
  property_type: PropertyType;
  pricing_mode?: PricingMode | null;
}): boolean {
  return isCommercialType(input.property_type) || input.pricing_mode === "sale";
}

export function hasCommercialPriceRange(input: CommercialRangeInput): boolean {
  return (
    supportsListingPriceRange(input) &&
    input.rent_kes_max != null &&
    input.rent_kes_max > input.rent_kes
  );
}

export function hasCommercialAreaRange(input: CommercialRangeInput): boolean {
  return (
    isCommercialType(input.property_type) &&
    input.area_sqm != null &&
    input.area_sqm_max != null &&
    input.area_sqm_max > input.area_sqm
  );
}

export function formatListingPrice(input: CommercialRangeInput): string {
  const suffix = listingPriceSuffix(input);
  if (hasCommercialPriceRange(input)) {
    const max = input.rent_kes_max!;
    return `KES ${input.rent_kes.toLocaleString("en-KE")} – ${max.toLocaleString("en-KE")}${suffix}`;
  }
  return `${formatKes(input.rent_kes)}${suffix}`;
}

export function formatListingArea(input: CommercialRangeInput): string | null {
  if (input.area_sqm == null || input.area_sqm <= 0) return null;
  if (hasCommercialAreaRange(input)) {
    return `${input.area_sqm} – ${input.area_sqm_max} m²`;
  }
  return `${input.area_sqm} m²`;
}

export function normalizeCommercialRangeFields<T extends CommercialRangeInput>(data: T): T {
  const allowPriceRange = supportsListingPriceRange(data);
  const allowAreaRange = isCommercialType(data.property_type);

  const rent_kes_max =
    allowPriceRange && data.rent_kes_max != null && data.rent_kes_max > data.rent_kes
      ? data.rent_kes_max
      : null;
  const area_sqm_max =
    allowAreaRange &&
    data.area_sqm != null &&
    data.area_sqm_max != null &&
    data.area_sqm_max > data.area_sqm
      ? data.area_sqm_max
      : null;

  return { ...data, rent_kes_max, area_sqm_max };
}

export function validateCommercialRanges(
  data: CommercialRangeInput,
  onIssue: (path: string, message: string) => void,
): void {
  if (supportsListingPriceRange(data)) {
    if (data.rent_kes_max != null && data.rent_kes_max < data.rent_kes) {
      onIssue("rent_kes_max", "Maximum price must be greater than or equal to the starting price");
    }
  }

  if (!isCommercialType(data.property_type)) return;

  if (data.area_sqm_max != null) {
    if (!data.area_sqm || data.area_sqm <= 0) {
      onIssue("area_sqm", "Enter a minimum size before setting a maximum size");
    } else if (data.area_sqm_max < data.area_sqm) {
      onIssue("area_sqm_max", "Maximum size must be greater than or equal to the minimum size");
    }
  }
}
