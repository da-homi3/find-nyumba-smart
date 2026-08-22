import type { SupabaseClient } from "@supabase/supabase-js";
import { attachPropertyLocationFks } from "@/lib/locations/attach-property";
import { recountLocationInventory } from "@/lib/locations/inventory";
import { asLooseDb } from "@/lib/db/loose-client";

/**
 * Daily maintenance: attach FKs for unlinked listings, then recount inventory
 * for locations touched in this run.
 */
export async function runLocationMaintenanceCron(admin: SupabaseClient): Promise<{
  scanned: number;
  attached: number;
  failed: number;
  inventoryRecounted: number;
}> {
  const db = asLooseDb(admin);
  const PAGE = 100;
  let offset = 0;
  let scanned = 0;
  let attached = 0;
  let failed = 0;
  const touched = new Set<string>();

  for (;;) {
    const { data: rows, error } = await db
      .from("properties")
      .select(
        "id,neighborhood,latitude,longitude,location_id,ward_location_id,constituency_location_id,county_location_id",
      )
      .eq("is_active", true)
      .is("location_id", null)
      .not("neighborhood", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    const batch = rows ?? [];
    if (!batch.length) break;

    for (const row of batch) {
      scanned += 1;
      const neighborhood = String(row.neighborhood ?? "").trim();
      if (neighborhood.length < 2) continue;
      try {
        await attachPropertyLocationFks(admin, row.id as string, neighborhood, {
          latitude: typeof row.latitude === "number" ? row.latitude : null,
          longitude: typeof row.longitude === "number" ? row.longitude : null,
        });
        const { data: after } = await db
          .from("properties")
          .select(
            "location_id,ward_location_id,constituency_location_id,county_location_id",
          )
          .eq("id", row.id)
          .maybeSingle();
        if (after?.location_id) {
          attached += 1;
          for (const id of [
            after.location_id,
            after.ward_location_id,
            after.constituency_location_id,
            after.county_location_id,
          ]) {
            if (id) touched.add(id as string);
          }
        } else {
          failed += 1;
        }
      } catch (err) {
        failed += 1;
        console.warn("[location-cron] attach failed", row.id, err);
      }
    }

    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  const touchedIds = [...touched];
  if (touchedIds.length) {
    await recountLocationInventory(admin, touchedIds);
  }

  return {
    scanned,
    attached,
    failed,
    inventoryRecounted: touchedIds.length,
  };
}
