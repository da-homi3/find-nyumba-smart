/** @deprecated Import from `@/data/kenya-locations` instead. */
export { NAIROBI_NEIGHBORHOODS, matchLocation } from "@/data/kenya-locations";
import { matchLocation, neighborhoodStorageValue } from "@/data/kenya-locations";

/** Returns the canonical neighbourhood string stored on listings. */
export function matchNeighborhood(input: string): string | null {
  const matched = matchLocation(input);
  return matched ? neighborhoodStorageValue(matched) : null;
}
