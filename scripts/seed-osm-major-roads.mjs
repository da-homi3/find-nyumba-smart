/**
 * Import major Kenya roads from OpenStreetMap (Overpass) — real OSM names only.
 * Does NOT invent roads. Skips unnamed ways.
 *
 * Source: OpenStreetMap contributors (ODbL).
 * Usage: node scripts/seed-osm-major-roads.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cacheDir = join(root, "data", "kenya-admin");
const cacheFile = join(cacheDir, "osm-major-roads.json");

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
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201a\u201b'`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slugify(name) {
  return normalizeName(name).replace(/\s+/g, "-") || "road";
}

const OVERPASS = `
[out:json][timeout:180];
area["ISO3166-1"="KE"][admin_level=2]->.ke;
(
  way["highway"="motorway"](area.ke);
  way["highway"="trunk"](area.ke);
  way["highway"="primary"](area.ke);
);
out center tags;
`.trim();

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function loadRoads() {
  if (existsSync(cacheFile)) {
    return JSON.parse(readFileSync(cacheFile, "utf8"));
  }
  mkdirSync(cacheDir, { recursive: true });
  console.log("Querying Overpass (may take ~1–2 min)…");

  let lastErr;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 180000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "NyumbaSearchLocationSeed/1.0 (kenya major roads; contact: ops@nyumbasearch)",
        },
        body: `data=${encodeURIComponent(OVERPASS)}`,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`${endpoint} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      const json = await res.json();
      writeFileSync(cacheFile, JSON.stringify(json));
      return json;
    } catch (err) {
      lastErr = err;
      console.warn("Overpass failed:", err.message);
    }
  }
  throw lastErr ?? new Error("All Overpass endpoints failed");
}

const env = loadEnv();
const admin = createClient(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

await admin.from("location_sources").upsert(
  {
    name: "openstreetmap-kenya-major-roads",
    dataset_name: "OSM motorway/trunk/primary in Kenya",
    source_url: "https://www.openstreetmap.org/copyright",
    accessed_at: new Date().toISOString(),
    licence: "ODbL 1.0 (OpenStreetMap contributors)",
    geographic_coverage: "Kenya",
    confidence_default: 70,
    notes: "Named major roads only; unnamed ways skipped. Not KeNHA/KURA authoritative CAD.",
  },
  { onConflict: "name" },
);

const data = await loadRoads();
const elements = (data.elements ?? []).filter(
  (el) => el.type === "way" && el.tags?.name && el.center?.lat != null && el.center?.lon != null,
);

const { data: kenya } = await admin
  .from("locations")
  .select("id")
  .eq("location_type", "COUNTRY")
  .eq("country_code", "KE")
  .maybeSingle();

const parentId = kenya?.id ?? null;
const rows = [];
const seen = new Set();
for (const el of elements) {
  const name = String(el.tags.name).trim();
  const norm = normalizeName(name);
  if (!norm || seen.has(norm)) continue;
  seen.add(norm);
  const lat = el.center.lat;
  const lng = el.center.lon;
  if (lat < -5 || lat > 6 || lng < 33 || lng > 43) continue;
  rows.push({
    parent_id: parentId,
    name,
    normalized_name: norm,
    slug: slugify(name),
    location_type: "ROAD",
    country_code: "KE",
    latitude: lat,
    longitude: lng,
    source: "openstreetmap-kenya-major-roads",
    source_id: `osm:way:${el.id}`,
    source_url: `https://www.openstreetmap.org/way/${el.id}`,
    confidence_score: 70,
    is_official: false,
    is_active: true,
  });
}

console.log("Named major roads to upsert:", rows.length);
const BATCH = 80;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const { error } = await admin.from("locations").upsert(chunk, {
    onConflict: "source,source_id",
  });
  if (error) throw error;
  process.stdout.write(`\r  upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}   `);
}
console.log("\n✓ OSM major roads seeded");
