import { isDemoListingId } from "@/data/mockListings";
import type { Property } from "@/lib/properties";

export const PREVIEW_LISTING_NOTICE = "Preview listing — real uploads coming soon";

export function shouldObscureListing(property: Pick<Property, "id">): boolean {
  return isDemoListingId(property.id);
}
