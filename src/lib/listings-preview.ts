import listingPlaceholders from "@/data/listing-placeholders.json";
import type { Property } from "@/lib/properties";

const PLACEHOLDER_URLS = new Set(listingPlaceholders as string[]);

type ListingPreviewProbe = Pick<Property, "id" | "images">;

function usesOnlyPlaceholderImages(images: string[] | null | undefined): boolean {
  const list = images ?? [];
  if (list.length === 0) return true;
  return list.every((url) => PLACEHOLDER_URLS.has(url));
}

/** True for listings that still use stock placeholder photos (blur overlay). */
export function isPreviewListing(property: ListingPreviewProbe): boolean {
  return usesOnlyPlaceholderImages(property.images);
}

export function partitionListings<T extends ListingPreviewProbe>(properties: T[]) {
  const live: T[] = [];
  const preview: T[] = [];
  for (const property of properties) {
    if (isPreviewListing(property)) preview.push(property);
    else live.push(property);
  }
  return { live, preview };
}

/** Live listings only — placeholder cards are not shown. */
export function mergeListingsForDisplay<T extends ListingPreviewProbe>(properties: T[]): T[] {
  return partitionListings(properties).live;
}

export function previewListingStats(properties: ListingPreviewProbe[]) {
  const { live, preview } = partitionListings(properties);
  return {
    liveCount: live.length,
    previewCount: 0,
    hiddenPreviewCount: preview.length,
  };
}
