/** Counties with real provider coverage — mirrors `provider_counties` table. */
export const PROVIDER_COUNTIES = [
  { code: "nairobi", name: "Nairobi" },
  { code: "mombasa", name: "Mombasa" },
  { code: "kisumu", name: "Kisumu" },
  { code: "nakuru", name: "Nakuru" },
  { code: "kiambu", name: "Kiambu" },
  { code: "machakos", name: "Machakos" },
  { code: "uasin_gishu", name: "Uasin Gishu (Eldoret)" },
  { code: "kajiado", name: "Kajiado" },
  { code: "kericho", name: "Kericho" },
  { code: "kisii", name: "Kisii" },
  { code: "kakamega", name: "Kakamega" },
  { code: "nyeri", name: "Nyeri" },
  { code: "meru", name: "Meru" },
  { code: "narok", name: "Narok" },
] as const;

export type ProviderCountyCode = (typeof PROVIDER_COUNTIES)[number]["code"];

export const BESTCARE_COUNTIES = [
  "Nairobi",
  "Mombasa",
  "Nakuru",
  "Kiambu",
  "Machakos",
  "Uasin Gishu (Eldoret)",
  "Kericho",
  "Kisii",
  "Kakamega",
  "Nyeri",
  "Meru",
  "Narok",
] as const;

export function isValidCountyCode(code: string | undefined | null): code is ProviderCountyCode {
  if (!code) return false;
  return PROVIDER_COUNTIES.some((c) => c.code === code);
}

export function countyNameForCode(code: string | undefined | null): string | null {
  if (!code) return null;
  return PROVIDER_COUNTIES.find((c) => c.code === code)?.name ?? null;
}

export function normalizeProviderCounties(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((c): c is string => typeof c === "string" && c.length > 0);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((c): c is string => typeof c === "string" && c.length > 0)
        : [];
    } catch {
      return [];
    }
  }
  return ["Nairobi"];
}
