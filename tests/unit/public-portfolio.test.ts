import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/nyumba/nyumba-shared", () => ({
  mapPropertyRows: (rows: Record<string, unknown>[]) =>
    rows.map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? "Home"),
      owner_id: String(row.owner_id ?? ""),
      property_type: "bedsitter",
      neighborhood: String(row.neighborhood ?? ""),
      address: null,
      latitude: null,
      longitude: null,
      rent_kes: Number(row.rent_kes) || 0,
      deposit_kes: null,
      bedrooms: Number(row.bedrooms) || 0,
      bathrooms: Number(row.bathrooms) || 0,
      area_sqm: null,
      description: null,
      amenities: [],
      images: [],
      video_url: null,
      is_verified: row.is_verified === true,
      is_active: true,
      views: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      available_from: null,
    })),
}));

import { loadPublicProviderPortfolio } from "@/lib/landlord/public-portfolio";

describe("loadPublicProviderPortfolio", () => {
  it("loads organization portfolios by org id", async () => {
    const admin = {
      from: (table: string) => {
        if (table === "organizations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "org-1",
                    name: "Prime Estates",
                    logo_url: null,
                    slug: "prime-estates",
                    type: "agency",
                  },
                }),
              }),
            }),
          };
        }
        if (table === "properties") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: async () => ({
                      data: [
                        {
                          id: "p1",
                          title: "Studio in Kilimani",
                          property_type: "bedsitter",
                          neighborhood: "Kilimani",
                          address: null,
                          latitude: null,
                          longitude: null,
                          rent_kes: 25000,
                          rent_kes_max: null,
                          bedrooms: 0,
                          bathrooms: 1,
                          amenities: [],
                          images: [],
                          video_url: null,
                          tour_url: null,
                          is_verified: true,
                          is_active: true,
                          is_vacant: true,
                          authenticity_score: 80,
                          available_from: null,
                          pricing_mode: "rent",
                          price_period: "month",
                          views: 3,
                          created_at: "2026-01-01T00:00:00Z",
                          updated_at: "2026-01-01T00:00:00Z",
                          owner_id: "owner-1",
                          organization_id: "org-1",
                          featured_until: null,
                          boost_package: null,
                          nyumba_verified_at: null,
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as never;

    const portfolio = await loadPublicProviderPortfolio(admin, "org-1");
    expect(portfolio?.provider.kind).toBe("organization");
    expect(portfolio?.provider.name).toBe("Prime Estates");
    expect(portfolio?.provider.hasVerifiedListings).toBe(true);
    expect(portfolio?.listings).toHaveLength(1);
  });

  it("returns null for unknown ids without provider role", async () => {
    const admin = {
      from: (table: string) => {
        if (table === "organizations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "user-1", full_name: "Sam", avatar_url: null },
                }),
              }),
            }),
          };
        }
        if (table === "user_roles") {
          return {
            select: () => ({
              eq: async () => ({ data: [{ role: "tenant" }] }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as never;

    const portfolio = await loadPublicProviderPortfolio(admin, "user-1");
    expect(portfolio).toBeNull();
  });
});
