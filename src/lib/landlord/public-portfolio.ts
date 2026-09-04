import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { mapPropertyRows } from "@/lib/api/nyumba/nyumba-shared";
import type { Property } from "@/lib/properties";

type Db = SupabaseClient<Database>;

const LISTING_COLUMNS =
  "id,title,property_type,neighborhood,address,latitude,longitude,rent_kes,rent_kes_max,bedrooms,bathrooms,amenities,images,video_url,tour_url,is_verified,is_active,is_vacant,authenticity_score,available_from,pricing_mode,price_period,views,created_at,updated_at,owner_id,organization_id,featured_until,boost_package,nyumba_verified_at";

export type PublicProviderKind = "organization" | "landlord";

export type PublicProviderPortfolio = {
  provider: {
    id: string;
    kind: PublicProviderKind;
    name: string;
    logoUrl: string | null;
    slug: string | null;
    listingCount: number;
    /** True when at least one active listing is NyumbaSearch-verified. */
    hasVerifiedListings: boolean;
  };
  listings: Property[];
};

export async function loadPublicProviderPortfolio(
  admin: Db,
  providerId: string,
): Promise<PublicProviderPortfolio | null> {
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, logo_url, slug, type")
    .eq("id", providerId)
    .maybeSingle();

  if (org) {
    const { data: rows, error } = await admin
      .from("properties")
      .select(LISTING_COLUMNS)
      .eq("organization_id", org.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(48);
    if (error) throw new Error(error.message);
    const listings = mapPropertyRows(rows ?? []);
    return {
      provider: {
        id: org.id,
        kind: "organization",
        name: org.name,
        logoUrl: org.logo_url,
        slug: org.slug,
        listingCount: listings.length,
        hasVerifiedListings: listings.some((l) => l.is_verified),
      },
      listings,
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", providerId)
    .maybeSingle();
  if (!profile) return null;

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", providerId);
  const roleSet = new Set((roles ?? []).map((r) => r.role));
  const isProvider =
    roleSet.has("landlord") ||
    roleSet.has("agency") ||
    roleSet.has("manager") ||
    roleSet.has("admin");
  if (!isProvider) return null;

  const { data: rows, error } = await admin
    .from("properties")
    .select(LISTING_COLUMNS)
    .eq("owner_id", providerId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(48);
  if (error) throw new Error(error.message);
  const listings = mapPropertyRows(rows ?? []);

  return {
    provider: {
      id: profile.id,
      kind: "landlord",
      name: profile.full_name?.trim() || "NyumbaSearch landlord",
      logoUrl: profile.avatar_url,
      slug: null,
      listingCount: listings.length,
      hasVerifiedListings: listings.some((l) => l.is_verified),
    },
    listings,
  };
}
