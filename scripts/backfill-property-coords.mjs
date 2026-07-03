/**
 * Backfill latitude/longitude for properties missing map coordinates.
 * Uses Nairobi neighborhood centroids (same logic as updateProperty server fn).
 *
 * Usage: node scripts/backfill-property-coords.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

const NAIROBI_CENTER = { lat: -1.286389, lng: 36.817223 };

const NEIGHBORHOOD_COORDS = {
  Kilimani: { lat: -1.2925, lng: 36.7925 },
  Westlands: { lat: -1.265, lng: 36.8125 },
  Karen: { lat: -1.315, lng: 36.695 },
  Lavington: { lat: -1.29, lng: 36.775 },
  Kileleshwa: { lat: -1.279, lng: 36.79 },
  Kasarani: { lat: -1.21, lng: 36.9 },
  "South B": { lat: -1.31, lng: 36.85 },
  "South C": { lat: -1.3025, lng: 36.834 },
  Roysambu: { lat: -1.2175, lng: 36.88 },
  Embakasi: { lat: -1.305, lng: 36.91 },
  Parklands: { lat: -1.262, lng: 36.825 },
  "Ngong Road": { lat: -1.298, lng: 36.768 },
  Ruaraka: { lat: -1.235, lng: 36.87 },
  Donholm: { lat: -1.295, lng: 36.895 },
  Buruburu: { lat: -1.285, lng: 36.87 },
  Langata: { lat: -1.34, lng: 36.765 },
  Runda: { lat: -1.205, lng: 36.805 },
  Gigiri: { lat: -1.235, lng: 36.785 },
  Hurlingham: { lat: -1.288, lng: 36.765 },
  "Upper Hill": { lat: -1.298, lng: 36.815 },
  CBD: { lat: -1.286, lng: 36.822 },
  Eastleigh: { lat: -1.275, lng: 36.845 },
  Zimmerman: { lat: -1.205, lng: 36.89 },
  "Thika Road": { lat: -1.205, lng: 36.87 },
  Ruaka: { lat: -1.185, lng: 36.775 },
  Ruiru: { lat: -1.15, lng: 36.96 },
  Rongai: { lat: -1.395, lng: 36.73 },
  Umoja: { lat: -1.285, lng: 36.885 },
  Nairobi: NAIROBI_CENTER,
};

function loadEnv() {
  const env = {};
  const text = readFileSync(join(root, ".env"), "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function resolveNeighborhoodKey(neighborhood) {
  const norm = (neighborhood ?? "").trim().toLowerCase();
  if (!norm) return "Nairobi";
  for (const key of Object.keys(NEIGHBORHOOD_COORDS)) {
    const keyNorm = key.toLowerCase();
    if (keyNorm === norm || norm.includes(keyNorm) || keyNorm.includes(norm)) return key;
  }
  return "Nairobi";
}

function neighborhoodCentroid(neighborhood) {
  const key = resolveNeighborhoodKey(neighborhood);
  return NEIGHBORHOOD_COORDS[key] ?? NAIROBI_CENTER;
}

function needsCoords(row) {
  const lat = row.latitude;
  const lng = row.longitude;
  if (lat == null || lng == null) return true;
  if (lat === 0 && lng === 0) return true;
  return false;
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data: rows, error } = await supabase
    .from("properties")
    .select("id, title, neighborhood, latitude, longitude")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const missing = (rows ?? []).filter(needsCoords);
  console.log(
    `Found ${missing.length} properties without valid coordinates (of ${rows?.length ?? 0})`,
  );

  if (missing.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  let updated = 0;
  for (const row of missing) {
    const centroid = neighborhoodCentroid(row.neighborhood);
    console.log(
      `${dryRun ? "[dry-run] " : ""}${row.title} (${row.neighborhood}) → ${centroid.lat}, ${centroid.lng}`,
    );
    if (dryRun) continue;

    const { error: updateError } = await supabase
      .from("properties")
      .update({
        latitude: centroid.lat,
        longitude: centroid.lng,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      console.error(`  failed ${row.id}:`, updateError.message);
      continue;
    }
    updated++;
  }

  console.log(dryRun ? "Dry run complete." : `Updated ${updated} properties.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
