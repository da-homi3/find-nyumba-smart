/**
 * Attach geoBoundaries ADM1 (county) polygons to existing COUNTY rows.
 * Source: https://www.geoboundaries.org (CC BY 4.0 / ODbL) — no invented boundaries.
 *
 * Usage: node scripts/seed-county-polygons.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cacheDir = join(root, "data", "kenya-admin");
const cacheFile = join(cacheDir, "geoboundaries-ken-adm1-simplified.geojson");

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
      env[k] = t
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
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

function countyLookupKey(countyName) {
  const n = normalizeName(countyName);
  if (n === "nairobi" || n === "nairobi city" || n === "nairobi city county") return "nairobi city";
  if (n === "muranga" || n === "murang a") return "murang a";
  if (n === "elgeyo marakwet" || n === "elgeyomarakwet") return "elgeyo marakwet";
  if (n === "trans nzoia" || n === "transnzoia") return "trans nzoia";
  if (n === "taita taveta" || n === "taitataveta") return "taita taveta";
  if (n === "tharaka nithi" || n === "tharak nithi" || n === "tharaka") return "tharaka nithi";
  return n;
}

function featureCentroidBbox(geometry) {
  const flat = [];
  const walk = (node) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      flat.push([node[0], node[1]]);
      return;
    }
    for (const child of node) walk(child);
  };
  walk(geometry?.coordinates);
  if (!flat.length) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of flat) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    sumLng += lng;
    sumLat += lat;
  }
  return {
    latitude: sumLat / flat.length,
    longitude: sumLng / flat.length,
    bbox: [minLng, minLat, maxLng, maxLat],
  };
}

const API_META = "https://www.geoboundaries.org/api/current/gbOpen/KEN/ADM1/";

function toMediaUrl(githubRawUrl) {
  // GitHub stores large geoBoundaries files in LFS; media.githubusercontent.com serves bytes.
  return String(githubRawUrl)
    .replace("https://github.com/wmgeolab/geoBoundaries/raw/", "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/")
    .replace("https://raw.githubusercontent.com/wmgeolab/geoBoundaries/", "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/");
}

async function fetchText(url, ms = 180000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeGeojson(text) {
  const t = text.trimStart();
  return t.startsWith("{") || t.startsWith("[");
}

async function loadGeojson() {
  if (existsSync(cacheFile)) {
    const cached = readFileSync(cacheFile, "utf8");
    if (looksLikeGeojson(cached)) return JSON.parse(cached);
    console.warn("Ignoring invalid cache (likely Git LFS pointer)");
  }
  mkdirSync(cacheDir, { recursive: true });

  const candidates = [];
  try {
    const meta = JSON.parse(await fetchText(API_META, 30000));
    for (const key of ["simplifiedGeometryGeoJSON", "gjDownloadURLSimplified", "gjDownloadURL"]) {
      if (meta[key]) {
        candidates.push(toMediaUrl(meta[key]));
        candidates.push(meta[key]);
      }
    }
  } catch (err) {
    console.warn("geoBoundaries API unavailable:", err.message);
    candidates.push(
      toMediaUrl(
        "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KEN/ADM1/geoBoundaries-KEN-ADM1_simplified.geojson",
      ),
    );
  }

  let lastErr;
  for (const url of [...new Set(candidates)]) {
    try {
      console.log("Downloading", url);
      const text = await fetchText(url);
      if (!looksLikeGeojson(text)) throw new Error("response is not GeoJSON");
      writeFileSync(cacheFile, text);
      return JSON.parse(text);
    } catch (err) {
      lastErr = err;
      console.warn("download failed:", err.message);
    }
  }
  throw lastErr ?? new Error("No geoBoundaries download succeeded");
}

const env = loadEnv();
const admin = createClient(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

await admin.from("location_sources").upsert(
  {
    name: "geoboundaries-ken-adm1",
    dataset_name: "geoBoundaries Kenya ADM1",
    source_url: "https://www.geoboundaries.org/api/current/gbOpen/KEN/ADM1/",
    accessed_at: new Date().toISOString(),
    licence: "CC BY 4.0 / ODbL (geoBoundaries)",
    geographic_coverage: "Kenya counties",
    confidence_default: 95,
    notes: "Simplified ADM1 polygons attached to COUNTY rows by name match.",
  },
  { onConflict: "name" },
);

const geojson = await loadGeojson();
const features = geojson.features ?? [];
console.log("features", features.length);

const { data: counties } = await admin
  .from("locations")
  .select("id,name,normalized_name,source_id")
  .eq("location_type", "COUNTY")
  .eq("is_active", true);

const byNorm = new Map((counties ?? []).map((c) => [countyLookupKey(c.name), c]));

let updated = 0;
const missed = [];
for (const feature of features) {
  const shapeName = feature.properties?.shapeName || feature.properties?.name || "";
  const key = countyLookupKey(shapeName);
  const county = byNorm.get(key);
  if (!county) {
    missed.push(shapeName);
    continue;
  }
  const stats = featureCentroidBbox(feature.geometry);
  if (!stats) continue;
  const { error: upErr } = await admin
    .from("locations")
    .update({
      latitude: stats.latitude,
      longitude: stats.longitude,
      bbox: stats.bbox,
      source_url: "https://www.geoboundaries.org/",
      updated_at: new Date().toISOString(),
    })
    .eq("id", county.id);
  if (upErr) console.warn(upErr.message);
  else updated += 1;
}

// Apply true geom via Management API SQL when token present
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_REF ?? env.VITE_SUPABASE_PROJECT_ID;
let geomUpdated = 0;
if (token && ref) {
  for (const feature of features) {
    const shapeName = feature.properties?.shapeName || feature.properties?.name || "";
    const county = byNorm.get(countyLookupKey(shapeName));
    if (!county) continue;
    const geomJson = JSON.stringify(feature.geometry).replace(/'/g, "''");
    const sql = `UPDATE public.locations SET geom = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('${geomJson}'), 4326)), updated_at = now() WHERE id = '${county.id}'`;
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) geomUpdated += 1;
    else console.warn("geom fail", shapeName, await res.text().then((t) => t.slice(0, 200)));
  }
}

console.log(JSON.stringify({ updatedCentroids: updated, geomUpdated, missed }, null, 2));
