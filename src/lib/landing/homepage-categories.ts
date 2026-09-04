import type { PropertyType } from "@/lib/property-types";

export type HomepageCategoryLink = {
  type?: PropertyType;
  purpose?: "rent" | "sale";
};

export type HomepageCategory = {
  id: string;
  label: string;
  description: string;
  /** Property types included when counting live inventory on the homepage. */
  countTypes: readonly PropertyType[];
  search: HomepageCategoryLink;
};

/** Curated discovery cards — maps to `/categories/{id}` landings and `/tenant` search params. */
export const HOMEPAGE_PROPERTY_CATEGORIES: HomepageCategory[] = [
  {
    id: "student",
    label: "Student residence",
    description: "Hostels & shared housing near campuses",
    countTypes: ["hostel", "single_room"],
    search: { type: "hostel" },
  },
  {
    id: "bedsitter",
    label: "Bedsitters",
    description: "Compact units across Nairobi",
    countTypes: ["bedsitter", "studio"],
    search: { type: "bedsitter" },
  },
  {
    id: "one_bedroom",
    label: "1 bedroom",
    description: "Studios & one-bedroom apartments",
    countTypes: ["one_bedroom", "studio"],
    search: { type: "one_bedroom" },
  },
  {
    id: "two_bedroom",
    label: "2 bedrooms",
    description: "Popular for couples & small families",
    countTypes: ["two_bedroom"],
    search: { type: "two_bedroom" },
  },
  {
    id: "three_bedroom",
    label: "3 bedrooms",
    description: "Family-sized homes in top areas",
    countTypes: ["three_bedroom"],
    search: { type: "three_bedroom" },
  },
  {
    id: "four_plus",
    label: "4+ bedrooms",
    description: "Townhouses & large family homes",
    countTypes: ["four_bedroom", "townhouse", "maisonette"],
    search: { type: "four_bedroom" },
  },
  {
    id: "maisonette",
    label: "Maisonettes",
    description: "Split-level homes with space",
    countTypes: ["maisonette"],
    search: { type: "maisonette" },
  },
  {
    id: "townhouse",
    label: "Townhouses",
    description: "Modern multi-floor living",
    countTypes: ["townhouse"],
    search: { type: "townhouse" },
  },
  {
    id: "penthouse",
    label: "Penthouses",
    description: "Premium top-floor residences",
    countTypes: ["penthouse"],
    search: { type: "penthouse" },
  },
  {
    id: "house",
    label: "Houses",
    description: "Bungalows, villas & standalone homes",
    countTypes: ["bungalow", "villa"],
    search: { type: "bungalow" },
  },
  {
    id: "airbnb",
    label: "Airbnbs",
    description: "Nightly stays & holiday homes",
    countTypes: ["bnb", "hotel"],
    search: { type: "bnb" },
  },
  {
    id: "short_let",
    label: "Short lets",
    description: "Flexible stays for weeks or months",
    countTypes: ["guest_house", "bnb"],
    search: { type: "guest_house" },
  },
];

export function homepageCategoryById(id: string): HomepageCategory | undefined {
  return HOMEPAGE_PROPERTY_CATEGORIES.find((c) => c.id === id);
}

export function homepageCategoryPath(id: string): string {
  return `/categories/${id}`;
}

export function countListingsByHomepageCategory(
  properties: ReadonlyArray<{ property_type: PropertyType }>,
): Record<string, number> {
  const totals = Object.fromEntries(HOMEPAGE_PROPERTY_CATEGORIES.map((c) => [c.id, 0])) as Record<
    string,
    number
  >;

  for (const property of properties) {
    for (const category of HOMEPAGE_PROPERTY_CATEGORIES) {
      if (category.countTypes.includes(property.property_type)) {
        totals[category.id] += 1;
      }
    }
  }

  return totals;
}
