import { formatKes } from "@/lib/properties";
import type { ReasonCode, TenantNeeds } from "@/lib/recommendations/types";

type ReasonExtras = {
  rentKes?: number;
  neighborhood?: string;
  bedrooms?: number;
  previousRentKes?: number;
  newRentKes?: number;
};

function bedroomPhrase(count: number): string {
  if (count === 1) return "1 bedroom";
  return `${count} bedrooms`;
}

function withFallback(value: string | undefined, whenPresent: string, fallback: string): string {
  return value ? whenPresent : fallback;
}

const EXPLAINERS: Record<ReasonCode, (needs: TenantNeeds, extras?: ReasonExtras) => string> = {
  budget_match: (needs) => {
    const budget = needs.budgetMax ?? needs.budgetMin;
    return budget ? `Within your ${formatKes(budget)} budget` : "Matches your budget";
  },
  budget_flexible: (_needs, extras) =>
    extras?.rentKes
      ? `Slightly above your budget · ${formatKes(extras.rentKes)}`
      : "Slightly above your budget",
  location_match: (_needs, extras) =>
    withFallback(
      extras?.neighborhood,
      `${extras?.neighborhood} — one of your preferred areas`,
      "Matches your preferred location",
    ),
  near_preferred_location: (_needs, extras) =>
    withFallback(
      extras?.neighborhood,
      `Near your preferred area · ${extras?.neighborhood}`,
      "Near your preferred area",
    ),
  bedroom_match: (needs) =>
    needs.bedrooms != null
      ? `${bedroomPhrase(needs.bedrooms)} — your preferred size`
      : "Matches your preferred size",
  property_type_match: () => "Matches your preferred property type",
  amenity_match: () => "Has amenities you care about",
  parking_match: () => "Parking available",
  move_in_match: (needs) =>
    needs.moveInDate ? "Available around your move-in date" : "Available soon",
  saved_similar: () => "Similar to properties you've saved",
  viewed_similar: () => "Similar to homes you've been viewing",
  search_match: () => "Matches your recent search",
  provider_followed: () => "From a provider you follow",
  price_drop: (_needs, extras) => {
    if (extras?.previousRentKes != null && extras?.newRentKes != null) {
      return `Was ${formatKes(extras.previousRentKes)} · now ${formatKes(extras.newRentKes)}`;
    }
    return "Price dropped on a home you know";
  },
  new_listing: () => "Just listed",
  popular_in_preferred_area: () => "Popular in your preferred area",
  verified_quality: () => "Verified listing with complete details",
};

export function explainReason(code: ReasonCode, needs: TenantNeeds, extras?: ReasonExtras): string {
  const explain = EXPLAINERS[code];
  return explain ? explain(needs, extras) : "Matches what you're looking for";
}
