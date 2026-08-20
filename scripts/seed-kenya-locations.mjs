/**
 * Idempotent Kenya location seed (IEBC hierarchy + urban localities catalog).
 * Usage: node scripts/seed-kenya-locations.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const ACCESSED = new Date().toISOString().slice(0, 10);
const BATCH = 100;

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

/** Map catalog county labels onto IEBC county normalized names. */
function countyLookupKey(countyName) {
  const n = normalizeName(countyName);
  if (n === "nairobi" || n === "nairobi city" || n === "nairobi city county") return "nairobi city";
  if (n === "muranga" || n === "murang a") return "murang a";
  if (n === "elgeyo marakwet" || n === "elgeyomarakwet") return "elgeyo marakwet";
  if (n === "trans nzoia" || n === "transnzoia") return "trans nzoia";
  if (n === "taita taveta" || n === "taitataveta") return "taita taveta";
  if (n === "tharak nithi" || n === "tharaka nithi") return "tharaka nithi";
  return n;
}

function slugify(name) {
  return normalizeName(name).replace(/\s+/g, "-") || "unknown";
}

const env = loadEnv();
const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const hierarchy = JSON.parse(
  readFileSync(join(root, "data", "kenya-admin", "county_data.json"), "utf8"),
);
const localities = JSON.parse(
  readFileSync(join(root, "src", "data", "kenya-locations.json"), "utf8"),
);

const IEBC_SOURCE = "iebc-hierarchy-stevehoober254";
const CATALOG_SOURCE = "nyumbasearch-kenya-locations-catalog";
const IEBC_URL =
  "https://github.com/stevehoober254/kenya-county-data (IEBC-derived public hierarchy)";

const report = {
  accessed_at: ACCESSED,
  sources: [IEBC_SOURCE, CATALOG_SOURCE],
  counts: {},
  errors: [],
  warnings: [],
};

async function upsertSource(row) {
  const { error } = await admin.from("location_sources").upsert(row, { onConflict: "name" });
  if (error) throw new Error(`location_sources: ${error.message}`);
}

async function upsertBatch(rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await admin.from("locations").upsert(chunk, {
      onConflict: "source,source_id",
      ignoreDuplicates: false,
    });
    if (error) throw new Error(`locations batch ${i}: ${error.message}`);
    process.stdout.write(`\r  upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}   `);
  }
  process.stdout.write("\n");
}

async function loadIdMap(sourcePrefix) {
  const map = new Map();
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from("locations")
      .select("id, source_id")
      .eq("source", IEBC_SOURCE)
      .like("source_id", `${sourcePrefix}%`)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) map.set(row.source_id, row.id);
    if (data.length < 1000) break;
    from += 1000;
  }
  return map;
}

async function ensureAliases(rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await admin.from("location_aliases").upsert(chunk, {
      onConflict: "location_id,normalized_alias",
      ignoreDuplicates: true,
    });
    if (error) report.warnings.push(`aliases batch: ${error.message}`);
  }
}

const countyCentroid = new Map();
for (const loc of localities) {
  if (loc.name === loc.county || !countyCentroid.has(loc.county)) {
    countyCentroid.set(loc.county, { lat: loc.lat, lng: loc.lng });
  }
}

console.log("Sources…");
await upsertSource({
  name: IEBC_SOURCE,
  dataset_name: "kenya-county-data county_data.json",
  source_url: IEBC_URL,
  accessed_at: new Date().toISOString(),
  dataset_version: "public-github",
  geographic_coverage: "Kenya — 47 counties, 290 constituencies, 1450 wards",
  identifier_system: "name hierarchy (IEBC-derived)",
  licence: "Open / credit IEBC",
  confidence_default: 95,
  notes: "Electoral hierarchy. Constituencies are IEBC constituencies, not KNBS sub-counties.",
});
await upsertSource({
  name: CATALOG_SOURCE,
  dataset_name: "kenya-locations.json",
  source_url: "find-nyumba-smart/src/data/kenya-locations.json",
  accessed_at: new Date().toISOString(),
  geographic_coverage: "Kenya place centroids used by NyumbaSearch",
  identifier_system: "name+county",
  licence: "Internal catalog",
  confidence_default: 60,
  notes: "Informal LOCALITY/NEIGHBOURHOOD points; is_official=false.",
});

console.log("Country…");
await upsertBatch([
  {
    parent_id: null,
    name: "Kenya",
    normalized_name: "kenya",
    slug: "kenya",
    location_type: "COUNTRY",
    official_code: "KE",
    country_code: "KE",
    latitude: 0.0236,
    longitude: 37.9062,
    source: IEBC_SOURCE,
    source_id: "country:KE",
    source_url: IEBC_URL,
    confidence_score: 100,
    is_official: true,
    is_active: true,
  },
]);
const countryMap = await loadIdMap("country:");
const countryId = countryMap.get("country:KE");
if (!countryId) throw new Error("Country row missing after upsert");

console.log("Counties…");
const countyRows = [];
let countyIdx = 0;
for (const county of hierarchy) {
  const countyName = county.name?.trim();
  if (!countyName) continue;
  countyIdx++;
  const centroid = countyCentroid.get(countyName);
  const countyCode = String(countyIdx).padStart(2, "0");
  countyRows.push({
    parent_id: countryId,
    name: countyName,
    normalized_name: countyLookupKey(countyName),
    slug: slugify(countyName),
    location_type: "COUNTY",
    official_code: `county:${slugify(countyName)}`,
    country_code: "KE",
    county_code: countyCode,
    latitude: centroid?.lat ?? null,
    longitude: centroid?.lng ?? null,
    source: IEBC_SOURCE,
    source_id: `county:${countyLookupKey(countyName)}`,
    source_url: IEBC_URL,
    confidence_score: 95,
    is_official: true,
    is_active: true,
  });
}
await upsertBatch(countyRows);
const countyIdBySource = await loadIdMap("county:");

console.log("Constituencies…");
const constituencyRows = [];
for (const county of hierarchy) {
  const countyName = county.name?.trim();
  if (!countyName) continue;
  const countyId = countyIdBySource.get(`county:${normalizeName(countyName)}`);
  if (!countyId) {
    report.warnings.push(`Missing county id for ${countyName}`);
    continue;
  }
  const countyCode = countyRows.find((r) => r.name === countyName)?.county_code;
  const centroid = countyCentroid.get(countyName);
  for (const constituency of county.constituencies ?? []) {
    const cName = constituency.name?.trim();
    if (!cName) continue;
    constituencyRows.push({
      parent_id: countyId,
      name: cName,
      normalized_name: normalizeName(cName),
      slug: slugify(cName),
      location_type: "CONSTITUENCY",
      official_code: `constituency:${slugify(countyName)}:${slugify(cName)}`,
      country_code: "KE",
      county_code: countyCode,
      constituency_code: slugify(cName),
      latitude: centroid?.lat ?? null,
      longitude: centroid?.lng ?? null,
      source: IEBC_SOURCE,
      source_id: `constituency:${normalizeName(countyName)}:${normalizeName(cName)}`,
      source_url: IEBC_URL,
      confidence_score: 95,
      is_official: true,
      is_active: true,
    });
  }
}
await upsertBatch(constituencyRows);
const constituencyIdBySource = await loadIdMap("constituency:");

console.log("Wards…");
const wardRows = [];
for (const county of hierarchy) {
  const countyName = county.name?.trim();
  if (!countyName) continue;
  const countyCode = countyRows.find((r) => r.name === countyName)?.county_code;
  const centroid = countyCentroid.get(countyName);
  for (const constituency of county.constituencies ?? []) {
    const cName = constituency.name?.trim();
    if (!cName) continue;
    const parentId = constituencyIdBySource.get(
      `constituency:${normalizeName(countyName)}:${normalizeName(cName)}`,
    );
    if (!parentId) {
      report.warnings.push(`Missing constituency ${cName} / ${countyName}`);
      continue;
    }
    for (const ward of constituency.wards ?? []) {
      const wName = ward.name?.trim();
      if (!wName) continue;
      wardRows.push({
        parent_id: parentId,
        name: wName,
        normalized_name: normalizeName(wName),
        slug: slugify(wName),
        location_type: "WARD",
        official_code: `ward:${slugify(countyName)}:${slugify(cName)}:${slugify(wName)}`,
        country_code: "KE",
        county_code: countyCode,
        constituency_code: slugify(cName),
        ward_code: slugify(wName),
        latitude: centroid?.lat ?? null,
        longitude: centroid?.lng ?? null,
        source: IEBC_SOURCE,
        source_id: `ward:${normalizeName(countyName)}:${normalizeName(cName)}:${normalizeName(wName)}`,
        source_url: IEBC_URL,
        confidence_score: 90,
        is_official: true,
        is_active: true,
      });
    }
  }
}
await upsertBatch(wardRows);

console.log("Localities…");
const localityRows = [];
for (const loc of localities) {
  const countyId = countyIdBySource.get(`county:${countyLookupKey(loc.county)}`);
  if (!countyId) {
    report.warnings.push(`No county for locality ${loc.name}, ${loc.county}`);
    continue;
  }
  const isNairobiHood =
    countyLookupKey(loc.county) === "nairobi city" && normalizeName(loc.name) !== "nairobi";
  localityRows.push({
    parent_id: countyId,
    name: loc.name,
    normalized_name: normalizeName(loc.name),
    slug: slugify(loc.name),
    location_type: isNairobiHood ? "NEIGHBOURHOOD" : "LOCALITY",
    country_code: "KE",
    latitude: loc.lat,
    longitude: loc.lng,
    source: CATALOG_SOURCE,
    source_id: `locality:${countyLookupKey(loc.county)}:${normalizeName(loc.name)}`,
    source_url: "find-nyumba-smart/src/data/kenya-locations.json",
    confidence_score: 60,
    is_official: false,
    is_active: true,
  });
}
// CBD synthetic locality (catalog gap)
const nairobiId = countyIdBySource.get("county:nairobi city");
if (nairobiId) {
  localityRows.push({
    parent_id: nairobiId,
    name: "Nairobi CBD",
    normalized_name: "nairobi cbd",
    slug: "nairobi-cbd",
    location_type: "LOCALITY",
    country_code: "KE",
    latitude: -1.286389,
    longitude: 36.817223,
    source: CATALOG_SOURCE,
    source_id: "locality:nairobi city:nairobi cbd",
    confidence_score: 55,
    is_official: false,
    is_active: true,
  });
}
await upsertBatch(localityRows);

console.log("Aliases…");
const { data: allForAlias } = await admin
  .from("locations")
  .select("id, name, normalized_name, location_type, parent_id, source_id")
  .eq("is_active", true)
  .limit(5000);

// Reload counties for parent names via a second query if needed — build aliases from known rows
const aliasRows = [];
function pushAlias(locationId, alias, kind) {
  const normalized_alias = normalizeName(alias);
  if (!locationId || !normalized_alias) return;
  aliasRows.push({
    location_id: locationId,
    alias: String(alias).trim(),
    normalized_alias,
    alias_kind: kind,
  });
}

for (const row of allForAlias ?? []) {
  pushAlias(row.id, row.name, "official");
  if (row.location_type === "COUNTY") pushAlias(row.id, `${row.name} County`, "common");
  if (row.location_type === "WARD") pushAlias(row.id, `${row.name} Ward`, "common");
  if (row.location_type === "CONSTITUENCY" && row.normalized_name === "westlands") {
    pushAlias(row.id, "Westland", "typo");
    pushAlias(row.id, "Westlands Nairobi", "search");
  }
  if (row.normalized_name === "nairobi cbd") {
    pushAlias(row.id, "CBD", "abbreviation");
    pushAlias(row.id, "City Centre", "colloquial");
  }
}

// Search aliases for localities: "Name, County"
for (const loc of localities) {
  const sid = `locality:${countyLookupKey(loc.county)}:${normalizeName(loc.name)}`;
  const { data: hit } = await admin
    .from("locations")
    .select("id")
    .eq("source", CATALOG_SOURCE)
    .eq("source_id", sid)
    .maybeSingle();
  if (hit?.id && loc.county !== loc.name) {
    pushAlias(hit.id, `${loc.name}, ${loc.county}`, "search");
  }
  if (hit?.id && countyLookupKey(loc.county) === "nairobi city" && normalizeName(loc.name) !== "nairobi") {
    pushAlias(hit.id, `${loc.name} Nairobi`, "search");
  }
}

// County display aliases
const nairobiCountyId = countyIdBySource.get("county:nairobi city");
if (nairobiCountyId) {
  pushAlias(nairobiCountyId, "Nairobi", "common");
  pushAlias(nairobiCountyId, "Nairobi County", "common");
}
const murangaId = countyIdBySource.get("county:murang a");
if (murangaId) {
  pushAlias(murangaId, "Murang'a", "spelling");
  pushAlias(murangaId, "Muranga", "spelling");
}

await ensureAliases(aliasRows);

report.counts = {
  countries: 1,
  counties: countyRows.length,
  constituencies: constituencyRows.length,
  wards: wardRows.length,
  localities: localityRows.length,
  aliases: aliasRows.length,
};

if (countyRows.length !== 47) report.errors.push(`Expected 47 counties, got ${countyRows.length}`);
if (constituencyRows.length !== 290) {
  report.warnings.push(`Expected 290 constituencies, got ${constituencyRows.length}`);
}
if (wardRows.length !== 1450) report.warnings.push(`Expected 1450 wards, got ${wardRows.length}`);

mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(join(root, "docs", "location-seed-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.counts, null, 2));
if (report.warnings.length) console.warn("warnings:", report.warnings.slice(0, 10));
if (report.errors.length) {
  console.error(report.errors);
  process.exit(1);
}
console.log("✓ seed complete");
