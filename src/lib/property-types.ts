/** Single source of truth for rental property categories (filters, wizard, labels). */
export const PROPERTY_TYPE_OPTIONS = [
  { id: "bedsitter", label: "Bedsitter" },
  { id: "single_room", label: "Single room" },
  { id: "studio", label: "Studio" },
  { id: "hostel", label: "Hostel" },
  { id: "one_bedroom", label: "1 bedroom" },
  { id: "two_bedroom", label: "2 bedroom" },
  { id: "three_bedroom", label: "3 bedroom" },
  { id: "four_bedroom", label: "4 bedroom" },
  { id: "maisonette", label: "Maisonette" },
  { id: "bungalow", label: "Bungalow" },
  { id: "townhouse", label: "Townhouse" },
  { id: "penthouse", label: "Penthouse" },
  { id: "guest_house", label: "Guest house" },
  { id: "commercial", label: "Commercial" },
] as const;

export type PropertyType = (typeof PROPERTY_TYPE_OPTIONS)[number]["id"];

export const PROPERTY_TYPES = PROPERTY_TYPE_OPTIONS.map((o) => o.id) as PropertyType[];

export function prettyPropertyType(type: PropertyType): string {
  return PROPERTY_TYPE_OPTIONS.find((o) => o.id === type)?.label ?? type.replaceAll("_", " ");
}
