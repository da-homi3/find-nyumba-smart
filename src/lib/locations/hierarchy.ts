import type { LocationsDb } from "./db";
import type { LocationPublic, LocationRow } from "./types";
import { toPublicLocation } from "./format";

const SELECT_COLS =
  "id,parent_id,name,normalized_name,slug,location_type,latitude,longitude,is_official,confidence_score,inventory_count";

export async function getLocationById(
  supabase: LocationsDb,
  id: string,
): Promise<LocationPublic | null> {
  const { data, error } = await supabase
    .from("locations")
    .select(SELECT_COLS)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return toPublicLocation(data as unknown as LocationRow);
}

export async function getLocationChildren(
  supabase: LocationsDb,
  id: string,
  options?: { types?: string[]; limit?: number },
): Promise<LocationPublic[]> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  let q = supabase
    .from("locations")
    .select(SELECT_COLS)
    .eq("parent_id", id)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(limit);
  if (options?.types?.length) {
    q = q.in("location_type", options.types);
  }
  const { data } = await q;
  return (data ?? []).map((row) => toPublicLocation(row as unknown as LocationRow));
}

export async function getLocationAncestors(
  supabase: LocationsDb,
  id: string,
): Promise<LocationPublic[]> {
  const chain: LocationPublic[] = [];
  let currentId: string | null = id;
  const seen = new Set<string>();
  for (let i = 0; i < 8 && currentId; i += 1) {
    if (seen.has(currentId)) break;
    seen.add(currentId);
    const { data } = await supabase
      .from("locations")
      .select(SELECT_COLS)
      .eq("id", currentId)
      .maybeSingle();
    if (!data) break;
    const pub = toPublicLocation(data as unknown as LocationRow);
    if (pub.id !== id) chain.push(pub);
    currentId = (data as { parent_id: string | null }).parent_id;
  }
  return chain.reverse();
}
