/** Single source of truth for rental property categories (filters, wizard, labels). */

export const PROPERTY_TYPE_OPTIONS = [
  { id: "bedsitter", label: "Bedsitter" },

  { id: "single_room", label: "Single room" },

  { id: "studio", label: "Studio" },

  { id: "hostel", label: "Hostel" },

  { id: "one_bedroom", label: "1 bedroom" },

  { id: "two_bedroom", label: "2 bedroom" },

  { id: "three_bedroom", label: "3 bedroom" },

  { id: "four_bedroom", label: "4 bedroom" },

  { id: "maisonette", label: "Maisonette" },

  { id: "bungalow", label: "Bungalow" },

  { id: "townhouse", label: "Townhouse" },

  { id: "penthouse", label: "Penthouse" },

  { id: "guest_house", label: "Guest house" },

  { id: "villa", label: "Villa" },

  { id: "bnb", label: "BnB" },

  { id: "hotel", label: "Hotel" },

  { id: "commercial", label: "Commercial" },
] as const;

export type PropertyType = (typeof PROPERTY_TYPE_OPTIONS)[number]["id"];

export const PROPERTY_TYPES = PROPERTY_TYPE_OPTIONS.map((o) => o.id) as PropertyType[];

export const PRICING_MODES = [
  { id: "rent", label: "For rent (lease)" },

  { id: "sale", label: "For sale" },

  { id: "booking", label: "Short-term booking" },
] as const;

export type PricingMode = (typeof PRICING_MODES)[number]["id"];

export const PRICE_PERIODS = [
  { id: "night", label: "Per night" },

  { id: "week", label: "Per week" },

  { id: "month", label: "Per month" },
] as const;

export type PricePeriod = (typeof PRICE_PERIODS)[number]["id"];

export const COMMERCIAL_MIN_RENT_PERIODS = [
  { months: 1, label: "1 month" },

  { months: 3, label: "3 months" },

  { months: 6, label: "6 months" },

  { months: 12, label: "12 months" },

  { months: 24, label: "730 days" },

  { months: 36, label: "36 months" },
] as const;

export function prettyPropertyType(type: PropertyType): string {
  return PROPERTY_TYPE_OPTIONS.find((o) => o.id === type)?.label ?? type.replaceAll("_", " ");
}

export function isCommercialType(type: PropertyType): boolean {
  return type === "commercial";
}

export function isNightlyRentType(type: PropertyType): boolean {
  return type === "bnb" || type === "hotel";
}

export function supportsBookingPricing(type: PropertyType): boolean {
  return isCommercialType(type) || isNightlyRentType(type);
}

/** Rent/sale selector — all types except short-stay (BnB/hotel), which use booking only. */

export function supportsRentSaleChoice(type: PropertyType): boolean {
  return !isNightlyRentType(type);
}

export function pricingModeOptionsForPropertyType(
  type: PropertyType,
): ReadonlyArray<(typeof PRICING_MODES)[number]> {
  if (isNightlyRentType(type)) {
    return PRICING_MODES.filter((mode) => mode.id === "booking");
  }

  if (isCommercialType(type)) {
    return PRICING_MODES;
  }

  return PRICING_MODES.filter((mode) => mode.id === "rent" || mode.id === "sale");
}

export function defaultPricingMode(type: PropertyType): PricingMode {
  if (isNightlyRentType(type)) return "booking";

  return "rent";
}

export function defaultPricePeriod(type: PropertyType, mode: PricingMode): PricePeriod | null {
  if (mode === "sale") return null;

  if (mode === "booking" || isNightlyRentType(type)) return "night";

  return "month";
}

export function normalizePricingMode(
  propertyType: PropertyType,

  mode: PricingMode | null | undefined,
): PricingMode {
  const next = mode ?? defaultPricingMode(propertyType);

  if (isNightlyRentType(propertyType)) return "booking";

  return next;
}

export function normalizePricePeriod(
  propertyType: PropertyType,

  mode: PricingMode,

  period: PricePeriod | null | undefined,
): PricePeriod | null {
  if (mode === "sale") return null;

  return period ?? defaultPricePeriod(propertyType, mode);
}

export function priceAmountLabel(mode: PricingMode, period: PricePeriod | null): string {
  if (mode === "sale") return "Sale price (KES)";

  if (mode === "booking") {
    if (period === "night") return "Rate (KES/night)";

    if (period === "week") return "Rate (KES/week)";

    return "Rate (KES/month)";
  }

  if (period === "week") return "Rent (KES/week)";

  return "Rent (KES/month)";
}

export function pricePeriodSuffix(
  mode: PricingMode,

  period: PricePeriod | null,

  propertyType?: PropertyType,
): string {
  if (mode === "sale") return "";

  if (period === "night") return "/ night";

  if (period === "week") return "/ week";

  if (period === "month") return "/ mo";

  if (propertyType && isNightlyRentType(propertyType)) return "/ night";

  return "/ mo";
}

/** @deprecated Use pricePeriodSuffix with pricing_mode + price_period */

export function rentPeriodLabel(type: PropertyType): string {
  if (isNightlyRentType(type)) return "/ night";

  return "/ mo";
}

/** @deprecated Use priceAmountLabel */

export function rentAmountLabel(type: PropertyType): string {
  if (isNightlyRentType(type)) return "Rate (KES/night)";

  return "Rent (KES/month)";
}

export function listingPriceSuffix(input: {
  property_type: PropertyType;

  pricing_mode?: PricingMode | null;

  price_period?: PricePeriod | null;
}): string {
  const mode = normalizePricingMode(input.property_type, input.pricing_mode);

  const period = normalizePricePeriod(input.property_type, mode, input.price_period);

  return pricePeriodSuffix(mode, period, input.property_type);
}

export function listingPriceAmountLabel(input: {
  property_type: PropertyType;

  pricing_mode?: PricingMode | null;

  price_period?: PricePeriod | null;
}): string {
  const mode = normalizePricingMode(input.property_type, input.pricing_mode);

  const period = normalizePricePeriod(input.property_type, mode, input.price_period);

  return priceAmountLabel(mode, period);
}

export function formatMinimumRentPeriod(months: number | null | undefined): string | null {
  if (!months || months < 1) return null;

  const match = COMMERCIAL_MIN_RENT_PERIODS.find((entry) => entry.months === months);

  return match ? match.label : `${months} months`;
}

export function formatPricePeriod(period: PricePeriod | null | undefined): string | null {
  if (!period) return null;

  return PRICE_PERIODS.find((entry) => entry.id === period)?.label ?? period;
}

export function pricingModeLabel(mode: PricingMode): string {
  return PRICING_MODES.find((entry) => entry.id === mode)?.label ?? mode;
}

export function normalizeMinimumRentPeriodMonths(
  propertyType: PropertyType,

  pricingMode: PricingMode,

  months: number | null | undefined,
): number | null {
  if (!isCommercialType(propertyType) || pricingMode !== "rent") return null;

  if (!months || months < 1) return null;

  return months;
}

export function listingPricingNote(input: {
  property_type: PropertyType;

  pricing_mode?: PricingMode | null;

  price_period?: PricePeriod | null;

  minimum_rent_period_months?: number | null;
}): string {
  const mode = normalizePricingMode(input.property_type, input.pricing_mode);

  const parts: string[] = [];

  if (mode === "sale" || isCommercialType(input.property_type)) {
    parts.push(pricingModeLabel(mode).toLowerCase());
  }

  if (mode === "rent" && input.minimum_rent_period_months) {
    parts.push(`min lease ${formatMinimumRentPeriod(input.minimum_rent_period_months)}`);
  }

  const period = normalizePricePeriod(input.property_type, mode, input.price_period);

  if (mode === "booking" && period) {
    parts.push(formatPricePeriod(period)!.toLowerCase());
  }

  return parts.length ? ` · ${parts.join(" · ")}` : "";
}
