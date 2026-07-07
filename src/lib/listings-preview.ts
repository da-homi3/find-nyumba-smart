import listingPlaceholders from "@/data/listing-placeholders.json";
import { isDemoListingId, mockListingsEnabled } from "@/data/mockListings";
import type { Property } from "@/lib/properties";

const PLACEHOLDER_URLS = new Set(listingPlaceholders as string[]);

type ListingPreviewProbe = Pick<Property, "id" | "images">;

function usesOnlyPlaceholderImages(images: string[] | null | undefined): boolean {
  const list = images ?? [];
  if (list.length === 0) return true;
  return list.every((url) => PLACEHOLDER_URLS.has(url));
}

/** True for demo IDs and seeded listings that still use stock placeholder photos. */
export function isPreviewListing(property: ListingPreviewProbe): boolean {
  if (mockListingsEnabled()) return true;
  if (isDemoListingId(property.id)) return true;
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

/**
 * Each live upload replaces one demo slot. Remaining demos stay visible but blurred.
 * Live listings are always shown first.
 */
export function mergeListingsForDisplay<T extends ListingPreviewProbe>(properties: T[]): T[] {
  const { live, preview } = partitionListings(properties);
  const previewSlots = Math.max(0, preview.length - live.length);
  return [...live, ...preview.slice(0, previewSlots)];
}

export function previewListingStats(properties: ListingPreviewProbe[]) {
  const { live, preview } = partitionListings(properties);
  const visiblePreview = Math.max(0, preview.length - live.length);
  return {
    liveCount: live.length,
    previewCount: visiblePreview,
    hiddenPreviewCount: preview.length - visiblePreview,
  };
}
