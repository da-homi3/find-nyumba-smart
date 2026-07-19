/** Canonical Kenyan rental amenities shown as chips and used for merge/normalize. */
export const CANONICAL_AMENITIES = [
  "WiFi",
  "Fibre",
  "Borehole",
  "Backup water",
  "Water tank",
  "Parking",
  "Covered parking",
  "Visitor parking",
  "Gym",
  "CCTV",
  "Security guard",
  "Gated community",
  "Electric fence",
  "Biometric access",
  "Generator",
  "Backup power",
  "Solar water heater",
  "Lift",
  "Balcony",
  "DSQ",
  "Servants quarter",
  "Furnished",
  "En-suite",
  "Wardrobe",
  "Hot shower",
  "Instant shower",
  "Swimming pool",
  "Kids play area",
  "Garden",
  "Rooftop",
  "Prepaid electricity",
  "DSTV",
  "Air conditioning",
  "Fridge",
  "Washing machine",
  "Microwave",
  "Kitchen cabinets",
  "Tiled floors",
  "Pet friendly",
  "Water included",
  "Service charge inclusive",
] as const;

export type CanonicalAmenity = (typeof CANONICAL_AMENITIES)[number];

/** Soft cap — high enough to capture every amenity mentioned in a long listing. */
const MAX_AMENITIES = 60;

/** Keyword → canonical label. Longer / more specific patterns first. */
const AMENITY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(fibre|fiber|safaricom\s*home|zuku|faiba)\b/i, label: "Fibre" },
  { re: /\b(wi[\s-]?fi|wireless\s*internet|internet)\b/i, label: "WiFi" },
  { re: /\bborehole\b/i, label: "Borehole" },
  { re: /\b(backup\s*water|water\s*backup|reliable\s*water)\b/i, label: "Backup water" },
  { re: /\b(water\s*tank|tank\s*water|overhead\s*tank)\b/i, label: "Water tank" },
  { re: /\b(water\s*(is\s*)?(included|inclusive)|inclusive\s*of\s*water)\b/i, label: "Water included" },
  { re: /\b(covered\s*parking|basement\s*parking|parking\s*bay)\b/i, label: "Covered parking" },
  { re: /\b(visitor\s*parking|guest\s*parking)\b/i, label: "Visitor parking" },
  { re: /\b(parking|car\s*park)\b/i, label: "Parking" },
  { re: /\b(gym|fitness\s*centre|fitness\s*center)\b/i, label: "Gym" },
  { re: /\bcctv\b/i, label: "CCTV" },
  { re: /\b(security guard|askari|24\/7 security|round-the-clock security)\b/i, label: "Security guard" },
  { re: /\b(gated(\s*community)?|controlled\s*access)\b/i, label: "Gated community" },
  { re: /\b(electric\s*fence|elec\.?\s*fence)\b/i, label: "Electric fence" },
  { re: /\b(biometric|fingerprint\s*access)\b/i, label: "Biometric access" },
  { re: /\b(generator|genset|backup\s*generator)\b/i, label: "Generator" },
  { re: /\b(backup\s*power|power\s*backup|inverter)\b/i, label: "Backup power" },
  { re: /\b(solar\s*(water\s*)?heater|solar\s*hot\s*water)\b/i, label: "Solar water heater" },
  { re: /\b(lift|elevator|elevator\s*access)\b/i, label: "Lift" },
  { re: /\bbalcony\b/i, label: "Balcony" },
  { re: /\b(dsq|domestic\s*staff\s*quarters?)\b/i, label: "DSQ" },
  { re: /\b(servants?\s*quarters?|sq\b)\b/i, label: "Servants quarter" },
  { re: /\bfurnished\b/i, label: "Furnished" },
  { re: /\b(en[\s-]?suite|ensuite)\b/i, label: "En-suite" },
  { re: /\b(wardrobe|built[\s-]*in\s*wardrobes?)\b/i, label: "Wardrobe" },
  { re: /\b(hot\s*shower|geyser)\b/i, label: "Hot shower" },
  { re: /\b(instant\s*shower)\b/i, label: "Instant shower" },
  { re: /\b(swimming\s*pool|pool)\b/i, label: "Swimming pool" },
  { re: /\b(kids?\s*play(\s*area)?|children'?s?\s*play)\b/i, label: "Kids play area" },
  { re: /\b(garden|compound)\b/i, label: "Garden" },
  { re: /\b(rooftop|roof\s*terrace)\b/i, label: "Rooftop" },
  { re: /\b(prepaid\s*(electricity|tokens?)|token\s*electricity|kenya\s*power\s*token)\b/i, label: "Prepaid electricity" },
  { re: /\b(dstv|gotv|satellite\s*tv)\b/i, label: "DSTV" },
  { re: /\b(air\s*conditioning|a\/c\b|\bac\b|aircon)\b/i, label: "Air conditioning" },
  { re: /\b(fridge|refrigerator)\b/i, label: "Fridge" },
  { re: /\b(washing\s*machine|washer)\b/i, label: "Washing machine" },
  { re: /\bmicrowave\b/i, label: "Microwave" },
  { re: /\b(kitchen\s*cabinets?|fitted\s*kitchen)\b/i, label: "Kitchen cabinets" },
  { re: /\b(tiled\s*floors?|tiles?\s*throughout)\b/i, label: "Tiled floors" },
  { re: /\b(pet[\s-]*friendly|pets?\s*allowed)\b/i, label: "Pet friendly" },
  { re: /\b(service\s*charge\s*(included|inclusive)|inclusive\s*of\s*service\s*charge)\b/i, label: "Service charge inclusive" },
];

function titleCaseAmenity(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const canonical = CANONICAL_AMENITIES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (canonical) return canonical;
  return trimmed
    .split(" ")
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(/\bWifi\b/i, "WiFi")
    .replace(/\bCctv\b/i, "CCTV")
    .replace(/\bDsq\b/i, "DSQ")
    .replace(/\bDstv\b/i, "DSTV");
}

export function parseAmenityString(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,;|]+/)
    .map((part) => titleCaseAmenity(part))
    .filter(Boolean);
}

export function mergeAmenities(...lists: Array<string[] | string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    const items = typeof list === "string" ? parseAmenityString(list) : (list ?? []);
    for (const item of items) {
      const labeled = titleCaseAmenity(item);
      if (!labeled) continue;
      const key = labeled.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(labeled);
      if (out.length >= MAX_AMENITIES) return out;
    }
  }
  return out;
}

export function formatAmenityString(amenities: string[] | string | null | undefined): string {
  const list = typeof amenities === "string" ? parseAmenityString(amenities) : mergeAmenities(amenities);
  return list.join(", ");
}

export function extractAmenitiesHeuristic(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  const found: string[] = [];
  const seen = new Set<string>();
  for (const { re, label } of AMENITY_PATTERNS) {
    if (!re.test(text)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(label);
    if (found.length >= MAX_AMENITIES) break;
  }
  return found;
}

export function clampAmenities(amenities: string[], max = MAX_AMENITIES): string[] {
  return mergeAmenities(amenities).slice(0, max);
}

export function amenitySelected(amenitiesCsv: string, label: string): boolean {
  const key = label.toLowerCase();
  return parseAmenityString(amenitiesCsv).some((a) => a.toLowerCase() === key);
}

export function toggleAmenityInString(amenitiesCsv: string, label: string): string {
  const current = parseAmenityString(amenitiesCsv);
  const key = label.toLowerCase();
  const exists = current.some((a) => a.toLowerCase() === key);
  const next = exists
    ? current.filter((a) => a.toLowerCase() !== key)
    : mergeAmenities(current, [label]);
  return formatAmenityString(next);
}
