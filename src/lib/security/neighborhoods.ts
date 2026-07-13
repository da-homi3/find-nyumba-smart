import {
  ALLOWED_NEIGHBORHOOD_FILTERS,
  matchLocation,
  neighborhoodStorageValue,
  parseCountyWideFilter,
} from "@/data/kenya-locations";

/** Whitelisted neighbourhood / area values for API listing filters. */
export const ALLOWED_NEIGHBORHOODS = ALLOWED_NEIGHBORHOOD_FILTERS;

export function normalizeNeighborhoodFilter(value: string | undefined | null): string | undefined {
  if (!value || value === "All") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (parseCountyWideFilter(trimmed)) return trimmed;
  if (ALLOWED_NEIGHBORHOODS.has(trimmed)) return trimmed;

  const matched = matchLocation(trimmed);
  if (matched) return neighborhoodStorageValue(matched);

  return undefined;
}

export { parseCountyWideFilter };
