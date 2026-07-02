import { matchNeighborhood } from "@/data/nairobi-neighborhoods";
import type { Database } from "@/integrations/supabase/types";

export type ImportRowInput = Record<string, string>;

export type ValidatedImportRow = {
  rowIndex: number;
  title: string;
  neighborhood: string;
  rent_kes: number;
  bedrooms: number;
  bathrooms: number;
  property_type: Database["public"]["Enums"]["property_type"];
  description: string | null;
  contact_phone: string | null;
  duplicate_hash: string;
};

export type RowValidationError = { rowIndex: number; reason: string };

const TYPE_MAP: Record<string, Database["public"]["Enums"]["property_type"]> = {
  bedsitter: "bedsitter",
  "1br": "one_bedroom",
  one_bedroom: "one_bedroom",
  "1_bedroom": "one_bedroom",
  "2br": "two_bedroom",
  two_bedroom: "two_bedroom",
  "2_bedroom": "two_bedroom",
  "3br": "three_bedroom",
  three_bedroom: "three_bedroom",
  studio: "studio",
  maisonette: "maisonette",
  bungalow: "bungalow",
};

function pick(row: ImportRowInput, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]?.trim();
    if (v) return v;
  }
  return "";
}

export async function duplicateHash(
  title: string,
  neighborhood: string,
  rent: number,
): Promise<string> {
  const raw = `${title.toLowerCase()}|${neighborhood.toLowerCase()}|${rent}`;
  const buf = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function validateImportRow(
  row: ImportRowInput,
  rowIndex: number,
): ValidatedImportRow | RowValidationError {
  const title = pick(row, "title", "name", "property_title");
  const priceRaw = pick(row, "price", "rent", "rent_kes", "monthly_rent");
  const hoodRaw = pick(row, "neighborhood", "location", "area", "estate");
  const bedsRaw = pick(row, "bedrooms", "beds", "bedroom");
  const bathsRaw = pick(row, "bathrooms", "baths", "bathroom");
  const typeRaw = pick(row, "property_type", "type", "unit_type").toLowerCase();

  if (!title) return { rowIndex, reason: "Title is required" };

  const rent = Number.parseInt(priceRaw.replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(rent) || rent <= 0)
    return { rowIndex, reason: "Price must be a positive integer" };

  const neighborhood = matchNeighborhood(hoodRaw);
  if (!neighborhood) return { rowIndex, reason: `Unknown neighborhood: ${hoodRaw || "(empty)"}` };

  const bedrooms = bedsRaw ? Number.parseInt(bedsRaw, 10) : 1;
  if (!Number.isFinite(bedrooms) || bedrooms < 0 || bedrooms > 10) {
    return { rowIndex, reason: "Bedrooms must be 0–10" };
  }

  const bathrooms = bathsRaw ? Number.parseInt(bathsRaw, 10) : 1;
  const property_type = TYPE_MAP[typeRaw] ?? (bedrooms === 0 ? "bedsitter" : "one_bedroom");

  return {
    rowIndex,
    title,
    neighborhood,
    rent_kes: rent,
    bedrooms,
    bathrooms: Number.isFinite(bathrooms) && bathrooms >= 1 ? bathrooms : 1,
    property_type,
    description: pick(row, "description", "details") || null,
    contact_phone: pick(row, "contact_phone", "phone", "landlord_phone") || null,
    duplicate_hash: "", // filled async
  };
}

export async function finalizeValidatedRow(row: ValidatedImportRow): Promise<ValidatedImportRow> {
  return {
    ...row,
    duplicate_hash: await duplicateHash(row.title, row.neighborhood, row.rent_kes),
  };
}
