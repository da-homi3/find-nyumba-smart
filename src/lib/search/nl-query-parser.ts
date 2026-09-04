import type { PropertySearchFilters } from "@/lib/properties";
import type { PropertyType } from "@/lib/property-types";
import { searchKenyaLocations } from "@/lib/geo/location-search";

export type ParsedNlSearch = {
  filters: Partial<PropertySearchFilters>;
  /** Unparsed tokens passed through as keyword search. */
  remainingQuery?: string;
  /** Human-readable summary chips for UI feedback. */
  hints: string[];
};

const BEDROOM_PATTERNS: Array<{ pattern: RegExp; type: PropertyType; label: string }> = [
  { pattern: /\bbedsitter\b/i, type: "bedsitter", label: "Bedsitter" },
  { pattern: /\b(studio|bedsit)\b/i, type: "studio", label: "Studio" },
  { pattern: /\b(single room|single-room)\b/i, type: "single_room", label: "Single room" },
  {
    pattern: /\b(1\s*br|1\s*bed(room)?|one\s*bed(room)?)\b/i,
    type: "one_bedroom",
    label: "1 bedroom",
  },
  {
    pattern: /\b(2\s*br|2\s*bed(room)?s?|two\s*bed(room)?s?)\b/i,
    type: "two_bedroom",
    label: "2 bedroom",
  },
  {
    pattern: /\b(3\s*br|3\s*bed(room)?s?|three\s*bed(room)?s?)\b/i,
    type: "three_bedroom",
    label: "3 bedroom",
  },
  {
    pattern: /\b(4\s*br|4\s*bed(room)?s?|four\s*bed(room)?s?)\b/i,
    type: "four_bedroom",
    label: "4 bedroom",
  },
  { pattern: /\bmaisonette\b/i, type: "maisonette", label: "Maisonette" },
  { pattern: /\bbungalow\b/i, type: "bungalow", label: "Bungalow" },
  { pattern: /\btownhouse\b/i, type: "townhouse", label: "Townhouse" },
  { pattern: /\bpenthouse\b/i, type: "penthouse", label: "Penthouse" },
  { pattern: /\bvilla\b/i, type: "villa", label: "Villa" },
];

function parseKesAmount(raw: string): number | null {
  const normalized = raw.replaceAll(",", "").trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(normalized);
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  if (match[2] === "m") return Math.round(base * 1_000_000);
  if (match[2] === "k") return Math.round(base * 1_000);
  return Math.round(base);
}

function stripMatched(text: string, pattern: RegExp): string {
  return text.replace(pattern, " ").replace(/\s+/g, " ").trim();
}

function stripMatchedLiteral(text: string, literal: string): string {
  if (!literal) return text;
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return stripMatched(text, new RegExp(escaped, "i"));
}

/**
 * Heuristic natural-language → structured listing filters.
 * Example: "2 bedroom apartment in Kilimani under 60k with parking"
 */
export function parseNlSearchQuery(input: string): ParsedNlSearch {
  const hints: string[] = [];
  const filters: Partial<PropertySearchFilters> = {};
  let text = input.trim();
  if (!text) return { filters, hints };

  if (/\b(for sale|buy|purchase)\b/i.test(text)) {
    filters.pricingMode = "sale";
    hints.push("For sale");
    text = stripMatched(text, /\b(for sale|buy|purchase)\b/gi);
  } else if (/\b(for rent|to rent|rental|rent)\b/i.test(text)) {
    filters.pricingMode = "rent";
    hints.push("For rent");
    text = stripMatched(text, /\b(for rent|to rent|rental|rent)\b/gi);
  }

  for (const { pattern, type, label } of BEDROOM_PATTERNS) {
    if (!pattern.test(text)) continue;
    filters.propertyType = type;
    hints.push(label);
    text = stripMatched(text, pattern);
    break;
  }

  const underMatch =
    /\b(?:under|below|max|upto|up to|less than|<=)\s*(?:kes|ksh|ksh\.|k)?\s*([\d,.]+[km]?)\b/i.exec(
      text,
    );
  if (underMatch) {
    const amount = parseKesAmount(underMatch[1]);
    if (amount != null) {
      filters.maxRent = amount;
      hints.push(`Under KES ${amount.toLocaleString("en-KE")}`);
      text = stripMatchedLiteral(text, underMatch[0]);
    }
  }

  const overMatch =
    /\b(?:from|above|over|at least|>=|min)\s*(?:kes|ksh|ksh\.|k)?\s*([\d,.]+[km]?)\b/i.exec(text);
  if (overMatch) {
    const amount = parseKesAmount(overMatch[1]);
    if (amount != null) {
      filters.minRent = amount;
      hints.push(`From KES ${amount.toLocaleString("en-KE")}`);
      text = stripMatchedLiteral(text, overMatch[0]);
    }
  }

  if (/\b(verified|verification level\s*2|l2\+?)\b/i.test(text)) {
    filters.verifiedOnly = true;
    hints.push("Verified L2+");
    text = stripMatched(text, /\b(verified|verification level\s*2|l2\+?)\b/gi);
  }

  if (/\b(parking|garage)\b/i.test(text)) {
    hints.push("Parking");
    text = stripMatched(text, /\b(parking|garage)\b/gi);
  }

  if (/\b(good water|water)\b/i.test(text)) {
    hints.push("Good water");
    text = stripMatched(text, /\b(good water|water)\b/gi);
  }

  if (/\b(security|gated)\b/i.test(text)) {
    hints.push("Security");
    text = stripMatched(text, /\b(security|gated)\b/gi);
  }

  const inMatch = /\b(?:in|around|near|at)\s+([a-z0-9][a-z0-9\s'-]{2,40})/i.exec(text);
  let locationQuery = inMatch?.[1]?.trim();
  if (locationQuery) {
    locationQuery = locationQuery.split(/\b(?:under|below|with|for|from|over|and)\b/i)[0]?.trim();
  }
  if (locationQuery) {
    const [best] = searchKenyaLocations(locationQuery);
    if (best?.neighborhood) {
      filters.neighborhood = best.neighborhood;
      hints.push(best.label);
      if (inMatch?.[0]) text = stripMatchedLiteral(text, inMatch[0]);
    }
  } else {
    const words = text.split(/\s+/).filter((w) => w.length >= 4);
    for (const word of words) {
      const [best] = searchKenyaLocations(word);
      if (best?.neighborhood && best.label.toLowerCase() === word.toLowerCase()) {
        filters.neighborhood = best.neighborhood;
        hints.push(best.label);
        text = stripMatched(text, new RegExp(`\\b${word}\\b`, "i"));
        break;
      }
    }
  }

  text = text
    .replace(
      /\b(apartment|flat|house|home|homes|listing|listings|with|and|in|near|around)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  return {
    filters,
    remainingQuery: text.length >= 2 ? text : undefined,
    hints,
  };
}

export function mergeNlSearchIntoFilters(
  base: PropertySearchFilters,
  parsed: ParsedNlSearch,
): PropertySearchFilters {
  return {
    ...base,
    ...parsed.filters,
    query: parsed.remainingQuery ?? (parsed.hints.length ? undefined : base.query),
  };
}
