import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { PropertyType } from "@/lib/property-types";

/**
 * Identity fields used to fingerprint a physical property so the same listing
 * cannot be posted twice (by the same or a different account). Rent and photos
 * are intentionally excluded — a property's identity does not change when it is
 * re-priced or re-photographed.
 *
 * NOTE: the normalization here is mirrored in scripts/backfill-duplicate-hash.mjs.
 * Keep the two in sync.
 */
export type ListingFingerprintInput = {
  title: string;
  neighborhood: string;
  property_type: PropertyType;
  bedrooms: number;
  address?: string | null;
};

type SupabaseAny = SupabaseClient<Database>;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function fingerprintComposite(input: ListingFingerprintInput): string {
  return [
    normalizeText(input.title),
    normalizeText(input.neighborhood),
    normalizeText(input.property_type),
    String(input.bedrooms ?? 0),
    normalizeText(input.address ?? ""),
  ].join("|");
}

/** Stable SHA-256 hex fingerprint of a property's identity. */
export async function computeListingFingerprint(input: ListingFingerprintInput): Promise<string> {
  const bytes = new TextEncoder().encode(fingerprintComposite(input));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type DuplicateMatch = {
  id: string;
  ownerId: string | null;
  organizationId: string | null;
};

/**
 * Find an active listing that is the same physical property as `input`.
 * Candidates are narrowed by the structural fields, then matched on the full
 * fingerprint (computed from each candidate's own fields so pre-existing rows
 * without a stored hash are still caught).
 */
export async function findDuplicateActiveListing(
  admin: SupabaseAny,
  input: ListingFingerprintInput,
  excludePropertyId?: string,
): Promise<DuplicateMatch | null> {
  const fingerprint = await computeListingFingerprint(input);

  let query = admin
    .from("properties")
    .select("id, owner_id, organization_id, title, neighborhood, property_type, bedrooms, address")
    .eq("is_active", true)
    .eq("neighborhood", input.neighborhood)
    .eq("property_type", input.property_type)
    .eq("bedrooms", input.bedrooms)
    .limit(200);
  if (excludePropertyId) query = query.neq("id", excludePropertyId);

  const { data: candidates, error } = await query;
  if (error) throw error;

  for (const candidate of candidates ?? []) {
    const candidateFingerprint = await computeListingFingerprint({
      title: candidate.title,
      neighborhood: candidate.neighborhood,
      property_type: candidate.property_type,
      bedrooms: candidate.bedrooms,
      address: candidate.address,
    });
    if (candidateFingerprint === fingerprint) {
      return {
        id: candidate.id,
        ownerId: candidate.owner_id,
        organizationId: candidate.organization_id,
      };
    }
  }

  return null;
}
