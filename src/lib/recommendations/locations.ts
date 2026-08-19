/** Explicit nearby clusters — never silently replace the tenant's preferred area. */
const NEARBY: Record<string, string[]> = {
  kilimani: ["hurlingham", "lavington", "kileleshwa", "ngong road", "yaya"],
  hurlingham: ["kilimani", "kileleshwa", "lavington"],
  lavington: ["kilimani", "kileleshwa", "lavington", "valley arcade"],
  kileleshwa: ["kilimani", "lavington", "riverside", "westlands"],
  westlands: ["parklands", "highridge", "kilimani", "riverside"],
  parklands: ["westlands", "highridge"],
  karen: ["langata", "ngong"],
  "south b": ["south c", "nairobi west"],
  "south c": ["south b", "langata"],
  kasarani: ["roysambu", "mwiki"],
  ruaka: ["banana", "ndenderu"],
  rongai: ["ongata rongai", "kiserian"],
  nyali: ["bamburi", "kizingo"],
};

export function normalizeLocation(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseLocations(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;/|]+/)
    .map(normalizeLocation)
    .filter((s) => s.length >= 2);
}

export function nearbyLocations(location: string): string[] {
  const key = normalizeLocation(location);
  return NEARBY[key] ?? [];
}

export function locationRelation(
  propertyNeighborhood: string,
  preferred: string[],
): "exact" | "nearby" | "none" {
  const hood = normalizeLocation(propertyNeighborhood);
  if (!hood || preferred.length === 0) return "none";
  if (preferred.some((p) => hood.includes(p) || p.includes(hood))) return "exact";
  for (const pref of preferred) {
    const near = nearbyLocations(pref);
    if (near.some((n) => hood.includes(n) || n.includes(hood))) return "nearby";
  }
  return "none";
}
