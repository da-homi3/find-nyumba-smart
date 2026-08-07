/** Listing display/entry currency. KES remains canonical for filters and unlock fees. */
export type ListingPriceCurrency = "KES" | "USD";

/**
 * Mid-market style KES per 1 USD for converting USD entry → rent_kes.
 * Used for search bands and unlock fees; update periodically if needed.
 */
export const USD_TO_KES_RATE = 130;

export function isListingPriceCurrency(value: unknown): value is ListingPriceCurrency {
  return value === "KES" || value === "USD";
}

export function formatUsd(amount: number): string {
  return `USD ${amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function usdToKes(usd: number, rate: number = USD_TO_KES_RATE): number {
  return Math.max(1, Math.round(usd * rate));
}

export function kesToUsd(kes: number, rate: number = USD_TO_KES_RATE): number {
  if (rate <= 0) return kes;
  return Math.round((kes / rate) * 100) / 100;
}

/** Normalize form amounts into DB columns for create/update. */
export function resolveListingPriceFields(input: {
  price_currency: ListingPriceCurrency;
  amount: number;
  amount_max?: number | null;
  deposit?: number | null;
}): {
  price_currency: ListingPriceCurrency;
  rent_kes: number;
  rent_kes_max: number | null;
  deposit_kes: number | null;
  rent_usd: number | null;
  rent_usd_max: number | null;
  deposit_usd: number | null;
} {
  const amount = Number(input.amount);
  const amountMax =
    input.amount_max != null && Number(input.amount_max) > amount ? Number(input.amount_max) : null;
  const deposit = input.deposit != null && Number(input.deposit) > 0 ? Number(input.deposit) : null;

  if (input.price_currency === "USD") {
    return {
      price_currency: "USD",
      rent_usd: amount,
      rent_usd_max: amountMax,
      deposit_usd: deposit,
      rent_kes: usdToKes(amount),
      rent_kes_max: amountMax != null ? usdToKes(amountMax) : null,
      deposit_kes: deposit != null ? usdToKes(deposit) : null,
    };
  }

  return {
    price_currency: "KES",
    rent_kes: Math.round(amount),
    rent_kes_max: amountMax != null ? Math.round(amountMax) : null,
    deposit_kes: deposit != null ? Math.round(deposit) : null,
    rent_usd: null,
    rent_usd_max: null,
    deposit_usd: null,
  };
}
