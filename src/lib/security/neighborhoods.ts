/** Whitelisted Nairobi neighbourhoods — reject unknown filter values at the API layer. */
export const ALLOWED_NEIGHBORHOODS = new Set([
  "Kilimani",
  "Westlands",
  "Karen",
  "Lavington",
  "Kasarani",
  "South B",
  "South C",
  "Roysambu",
  "Kileleshwa",
  "Embakasi",
  "Rongai",
  "Ruaka",
  "Ruiru",
  "Zimmerman",
  "Thika Road",
  "Lang'ata",
  "Ngong Road",
  "Eastleigh",
  "Donholm",
  "Parklands",
  "Hurlingham",
  "Upper Hill",
  "Gigiri",
  "Muthaiga",
]);

export function normalizeNeighborhoodFilter(value: string | undefined | null): string | undefined {
  if (!value || value === "All") return undefined;
  const trimmed = value.trim();
  if (!ALLOWED_NEIGHBORHOODS.has(trimmed)) return undefined;
  return trimmed;
}
