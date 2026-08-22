import type { SupabaseClient } from "@supabase/supabase-js";
import { asLooseDb } from "@/lib/db/loose-client";

/**
 * Recount inventory_count for the given location ids from active property FKs.
 * Counts distinct properties that reference the location in any location_* column.
 */
export async function recountLocationInventory(
  admin: SupabaseClient,
  locationIds: string[],
): Promise<void> {
  const ids = [...new Set(locationIds.filter(Boolean))];
  if (!ids.length) return;

  const db = asLooseDb(admin);
  for (const id of ids) {
    const { data: rows, error } = await db
      .from("properties")
      .select("id")
      .eq("is_active", true)
      .or(
        `location_id.eq.${id},ward_location_id.eq.${id},constituency_location_id.eq.${id},county_location_id.eq.${id}`,
      );
    if (error) {
      console.warn("[recountLocationInventory]", id, error.message);
      continue;
    }
    const total = new Set((rows ?? []).map((r) => r.id as string)).size;
    await db.from("locations").update({ inventory_count: total }).eq("id", id);
  }
}
