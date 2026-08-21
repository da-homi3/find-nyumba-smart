/** Shared Kenya place-name normalization (must stay aligned with seed script). */
export function normalizeLocationName(name: string): string {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201a\u201b'`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function slugifyLocationName(name: string): string {
  return normalizeLocationName(name).replace(/\s+/g, "-") || "unknown";
}

/** Map informal county labels onto IEBC normalized county keys. */
export function countyLookupKey(countyName: string): string {
  const n = normalizeLocationName(countyName);
  if (n === "nairobi" || n === "nairobi city" || n === "nairobi city county") return "nairobi city";
  if (n === "muranga" || n === "murang a") return "murang a";
  if (n === "elgeyo marakwet" || n === "elgeyomarakwet") return "elgeyo marakwet";
  if (n === "trans nzoia" || n === "transnzoia") return "trans nzoia";
  if (n === "taita taveta" || n === "taitataveta") return "taita taveta";
  if (n === "tharak nithi" || n === "tharaka nithi") return "tharaka nithi";
  return n;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cheap edit-distance for typo-tolerant matching. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prevDiag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, prevDiag + cost);
      prevDiag = temp;
    }
  }
  return prev[b.length]!;
}

/** Strip noise landlords often append — keep names like "Ngong Road" intact. */
export function scrubPlaceNoise(raw: string): string {
  return String(raw ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/^(along|near|off|at|opposite|next to|behind|beside)\s+/i, "")
    // Drop trailing landmark clauses: "Karen near tangaza university"
    .replace(/\s+(near|opposite|behind|beside|off|along)\s+.+$/i, "")
    .replace(/\s+(shopping\s+mall|stage|roundabout|junction)\b.*$/i, "")
    .replace(/[,;/|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COUNTY_HINTS = new Set([
  "nairobi",
  "nairobi city",
  "kiambu",
  "mombasa",
  "nakuru",
  "kisumu",
  "machakos",
  "kajiado",
  "kilifi",
  "kwale",
  "kitui",
  "nyeri",
  "meru",
  "uasin gishu",
  "kakamega",
]);

/** Split "Kilimani Nairobi" / "Kilimani, Nairobi" into place + optional county hint. */
export function parsePlaceQuery(q: string): { place: string; countyHint: string | null } {
  const raw = q.trim();
  if (!raw) return { place: "", countyHint: null };

  const comma = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (comma.length >= 2) {
    const head = scrubPlaceNoise(comma[0]!);
    const tailNorm = normalizeLocationName(comma.slice(1).join(" "));
    const countyHint = COUNTY_HINTS.has(tailNorm) ? comma.slice(1).join(" ") : null;
    // Prefer the first comma segment (usually the neighbourhood); fall back to scrubbed full text.
    const place = head || scrubPlaceNoise(raw);
    return { place, countyHint };
  }

  const scrubbed = scrubPlaceNoise(raw);
  const parts = scrubbed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!;
    if (COUNTY_HINTS.has(normalizeLocationName(last))) {
      return { place: parts.slice(0, -1).join(" "), countyHint: last };
    }
    // Two-word county names at the end (e.g. "Runda Nairobi City" already handled via normalize).
    if (parts.length >= 3) {
      const lastTwo = normalizeLocationName(`${parts[parts.length - 2]} ${parts[parts.length - 1]}`);
      if (COUNTY_HINTS.has(lastTwo)) {
        return {
          place: parts.slice(0, -2).join(" "),
          countyHint: `${parts[parts.length - 2]} ${parts[parts.length - 1]}`,
        };
      }
    }
  }
  return { place: scrubbed || raw, countyHint: null };
}
