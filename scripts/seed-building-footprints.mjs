/**
 * Optional building-footprint importer — requires a local GeoJSON from an open dataset
 * (e.g. Microsoft Building Footprints Kenya / OpenStreetMap extracts). Never invents buildings.
 *
 * Usage:
 *   node scripts/seed-building-footprints.mjs path/to/buildings.geojson
 *
 * Each feature needs properties.name OR properties.id; geometry Point or Polygon.
 * Polygons store centroid only in lat/lng (full geom optional via Management API later).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const filePath = process.argv[2];

if (!filePath || !existsSync(filePath)) {
  console.error(
    "Provide a real GeoJSON file path. Do not invent building footprints.\n" +
      "Example open sources: Microsoft Building Footprints (Kenya), OSM building extracts.",
  );
  process.exit(1);
}

function loadEnv() {
  const env = { ...process.env };
  const path = join(root, ".env");
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (env[k] === undefined) {
      env[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

function normalizeName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function centroidOf(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Point") {
    return { lng: geometry.coordinates[0], lat: geometry.coordinates[1] };
  }
  const flat = [];
  const walk = (node) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      flat.push([node[0], node[1]]);
      return;
    }
    for (const c of node) walk(c);
  };
  walk(geometry.coordinates);
  if (!flat.length) return null;
  let sx = 0,
    sy = 0;
  for (const [x, y] of flat) {
    sx += x;
    sy += y;
  }
  return { lng: sx / flat.length, lat: sy / flat.length };
}

const env = loadEnv();
const admin = createClient(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const geojson = JSON.parse(readFileSync(filePath, "utf8"));
const features = geojson.features ?? [];
console.log("features", features.length);

await admin.from("location_sources").upsert(
  {
    name: "building-footprints-file-import",
    dataset_name: filePath,
    source_url: filePath,
    accessed_at: new Date().toISOString(),
    licence: "See source file licence",
    notes: "Imported from operator-supplied open GeoJSON; no synthetic buildings.",
    confidence_default: 55,
  },
  { onConflict: "name" },
);

const rows = [];
for (const feature of features.slice(0, 5000)) {
  const props = feature.properties ?? {};
  const name = String(props.name || props.Name || props.id || "").trim();
  if (!name) continue;
  const c = centroidOf(feature.geometry);
  if (!c) continue;
  if (c.lat < -5 || c.lat > 6 || c.lng < 33 || c.lng > 43) continue;
  rows.push({
    name,
    normalized_name: normalizeName(name),
    slug: normalizeName(name).replace(/\s+/g, "-") || "building",
    location_type: "BUILDING",
    country_code: "KE",
    latitude: c.lat,
    longitude: c.lng,
    source: "building-footprints-file-import",
    source_id: `building:${normalizeName(name)}:${c.lat.toFixed(5)},${c.lng.toFixed(5)}`,
    confidence_score: 55,
    is_official: false,
    is_active: true,
  });
}

console.log("buildings to upsert", rows.length);
for (let i = 0; i < rows.length; i += 100) {
  const { error } = await admin.from("locations").upsert(rows.slice(i, i + 100), {
    onConflict: "source,source_id",
  });
  if (error) throw error;
}
console.log("✓ building footprints imported from file");
