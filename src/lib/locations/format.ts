import type { LocationPublic, LocationRow, LocationType } from "./types";

const TYPE_LABEL: Partial<Record<LocationType, string>> = {
  COUNTY: "County",
  CONSTITUENCY: "Constituency",
  WARD: "Ward",
  LOCALITY: "Town",
  NEIGHBOURHOOD: "Neighbourhood",
  ESTATE: "Estate",
  TOWN: "Town",
  CITY: "City",
  COUNTRY: "Country",
};

export function toPublicLocation(
  row: Pick<
    LocationRow,
    | "id"
    | "parent_id"
    | "name"
    | "slug"
    | "location_type"
    | "latitude"
    | "longitude"
    | "is_official"
    | "confidence_score"
    | "inventory_count"
  >,
  subtitle?: string,
): LocationPublic {
  const typeLabel = TYPE_LABEL[row.location_type] ?? row.location_type;
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    type: row.location_type,
    lat: row.latitude,
    lng: row.longitude,
    isOfficial: row.is_official,
    confidence: row.confidence_score,
    inventoryCount: row.inventory_count ?? 0,
    label: row.name,
    subtitle: subtitle ?? typeLabel,
  };
}

export function typeBoost(type: LocationType): number {
  switch (type) {
    case "NEIGHBOURHOOD":
    case "LOCALITY":
    case "ESTATE":
      return 25;
    case "WARD":
      return 15;
    case "CONSTITUENCY":
      return 10;
    case "COUNTY":
      return 5;
    default:
      return 0;
  }
}
