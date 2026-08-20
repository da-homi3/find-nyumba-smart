import staticRoutes from "./staticRoutes.json";
import { SEO_AREA_TYPES, SEO_INVENTORY_THRESHOLD, SEO_WARD_INVENTORY_THRESHOLD } from "@/lib/locations/types";

export type GeoArea = {
  slug: string;
  name: string;
  /** Optional locations.id when sourced from DB. */
  locationId?: string;
  countyName?: string;
  inventoryCount?: number;
  type?: string;
};

export const GEO_AREAS = staticRoutes.geoAreas as readonly GeoArea[];

const STATIC_SLUGS = new Set(GEO_AREAS.map((a) => a.slug));

export function areaSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

export function areaFromName(name: string): GeoArea | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return GEO_AREAS.find((area) => area.name.toLowerCase() === needle) ?? null;
}

export function areaFromSlug(slug: string): GeoArea | null {
  const normalized = areaSlug(slug);
  if (!normalized) return null;
  return GEO_AREAS.find((area) => area.slug === normalized) ?? null;
}

export function areaPathForName(name: string): string | null {
  const known = areaFromName(name);
  return known ? `/areas/${known.slug}` : null;
}

type DbAreaRow = {
  id: string;
  name: string;
  slug: string;
  inventory_count: number;
  location_type: string;
  parent_id: string | null;
};

/**
 * Inventory-gated area catalog: always includes the stable Nairobi static slugs,
 * plus active LOCALITY/NEIGHBOURHOOD/WARD rows with enough live listings.
 */
export async function loadIndexableAreas(): Promise<GeoArea[]> {
  const bySlug = new Map<string, GeoArea>();
  for (const area of GEO_AREAS) {
    bySlug.set(area.slug, { ...area });
  }

  try {
    const { createPublicClient } = await import("@/lib/api/public-client");
    const supabase = createPublicClient() as import("@/lib/locations/db").LocationsDb;
    const [{ data: denseAreas }, { data: wardAreas }] = await Promise.all([
      supabase
        .from("locations")
        .select("id,name,slug,inventory_count,location_type,parent_id")
        .eq("is_active", true)
        .in("location_type", ["LOCALITY", "NEIGHBOURHOOD", "ESTATE"])
        .gte("inventory_count", SEO_INVENTORY_THRESHOLD)
        .order("inventory_count", { ascending: false })
        .limit(800),
      supabase
        .from("locations")
        .select("id,name,slug,inventory_count,location_type,parent_id")
        .eq("is_active", true)
        .eq("location_type", "WARD")
        .gte("inventory_count", SEO_WARD_INVENTORY_THRESHOLD)
        .order("inventory_count", { ascending: false })
        .limit(2000),
    ]);
    const data = [...(denseAreas ?? []), ...(wardAreas ?? [])];

    const parentIds = [
      ...new Set(
        ((data ?? []) as unknown as DbAreaRow[])
          .map((r) => r.parent_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const parentNames = new Map<string, string>();
    if (parentIds.length) {
      const { data: parents } = await supabase
        .from("locations")
        .select("id,name")
        .in("id", parentIds);
      for (const p of (parents ?? []) as unknown as Array<{ id: string; name: string }>) {
        parentNames.set(p.id, p.name);
      }
    }

    for (const row of (data ?? []) as unknown as DbAreaRow[]) {
      const slug = areaSlug(row.slug || row.name);
      if (!slug) continue;
      // Never overwrite canonical static Nairobi slugs (stable SEO URLs).
      if (STATIC_SLUGS.has(slug)) {
        const existing = bySlug.get(slug)!;
        bySlug.set(slug, {
          ...existing,
          locationId: row.id,
          inventoryCount: row.inventory_count,
          countyName: existing.countyName ?? parentNames.get(row.parent_id ?? "") ?? "Nairobi",
        });
        continue;
      }
      if (bySlug.has(slug)) continue;
      bySlug.set(slug, {
        slug,
        name: row.name,
        locationId: row.id,
        inventoryCount: row.inventory_count,
        countyName: parentNames.get(row.parent_id ?? "") ?? undefined,
        type: row.location_type,
      });
    }
  } catch (err) {
    console.warn("loadIndexableAreas fallback to static:", err);
  }

  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function resolveAreaFromSlug(slug: string): Promise<GeoArea | null> {
  const staticHit = areaFromSlug(slug);
  if (staticHit) {
    // Enrich with inventory when available; always keep static pages indexable.
    try {
      const { createPublicClient } = await import("@/lib/api/public-client");
      const supabase = createPublicClient() as import("@/lib/locations/db").LocationsDb;
      const { data } = await supabase
        .from("locations")
        .select("id,name,slug,inventory_count,parent_id")
        .eq("is_active", true)
        .eq("slug", staticHit.slug)
        .in("location_type", [...SEO_AREA_TYPES])
        .maybeSingle();
      if (data) {
        const row = data as unknown as {
          id: string;
          inventory_count: number;
        };
        return {
          ...staticHit,
          locationId: row.id,
          inventoryCount: Number(row.inventory_count ?? 0),
        };
      }
    } catch {
      // ignore
    }
    return staticHit;
  }

  const normalized = areaSlug(slug);
  if (!normalized) return null;

  try {
    const { createPublicClient } = await import("@/lib/api/public-client");
    const supabase = createPublicClient() as import("@/lib/locations/db").LocationsDb;
    const { data } = await supabase
      .from("locations")
      .select("id,name,slug,inventory_count,location_type,parent_id")
      .eq("is_active", true)
      .eq("slug", normalized)
      .in("location_type", [...SEO_AREA_TYPES])
      .maybeSingle();

    if (!data) return null;
    const row = data as unknown as DbAreaRow;
    const inventory = Number(row.inventory_count ?? 0);
    // Thin pages: allow resolve for UX but caller should noindex when below threshold.
    return {
      slug: normalized,
      name: String(row.name),
      locationId: row.id,
      inventoryCount: inventory,
    };
  } catch {
    return null;
  }
}

export function shouldIndexArea(area: GeoArea): boolean {
  if (STATIC_SLUGS.has(area.slug)) return true;
  const inventory = area.inventoryCount ?? 0;
  if (area.type === "WARD") return inventory >= SEO_WARD_INVENTORY_THRESHOLD;
  return inventory >= SEO_INVENTORY_THRESHOLD;
}
