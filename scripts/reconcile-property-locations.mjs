/**
 * Batch-map properties.neighborhood (+ coords) → location FKs.
 * Preserves original neighborhood text. Idempotent.
 * Usage: node scripts/reconcile-property-locations.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PAGE = 100;

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

function parsePlace(q) {
  const raw = String(q ?? "").trim();
  if (!raw) return { place: "", countyHint: null };
  const comma = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (comma.length >= 2) return { place: comma[0], countyHint: comma.slice(1).join(" ") };
  const parts = raw.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const countyish = ["nairobi", "kiambu", "mombasa", "nakuru", "kisumu", "machakos", "kajiado"];
    if (countyish.includes(normalizeName(last))) {
      return { place: parts.slice(0, -1).join(" "), countyHint: last };
    }
  }
  return { place: raw, countyHint: null };
}

const env = loadEnv();
const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const report = {
  scanned: 0,
  matched: 0,
  needsReview: 0,
  unmatched: 0,
  skippedEmpty: 0,
  samples: [],
};

/** Prefetch searchable locations into memory for fast matching. */
console.log("Loading locations…");
const { data: locs, error: locErr } = await admin
  .from("locations")
  .select(
    "id,parent_id,name,normalized_name,slug,location_type,latitude,longitude,confidence_score,is_official",
  )
  .eq("is_active", true)
  .in("location_type", [
    "NEIGHBOURHOOD",
    "LOCALITY",
    "ESTATE",
    "WARD",
    "CONSTITUENCY",
    "COUNTY",
    "TOWN",
  ])
  .limit(8000);
if (locErr) throw locErr;

const { data: aliases } = await admin
  .from("location_aliases")
  .select("location_id,normalized_alias")
  .limit(10000);

const byId = new Map((locs ?? []).map((l) => [l.id, l]));
const byNorm = new Map();
for (const l of locs ?? []) {
  const list = byNorm.get(l.normalized_name) ?? [];
  list.push(l);
  byNorm.set(l.normalized_name, list);
}
for (const a of aliases ?? []) {
  const loc = byId.get(a.location_id);
  if (!loc) continue;
  const list = byNorm.get(a.normalized_alias) ?? [];
  list.push(loc);
  byNorm.set(a.normalized_alias, list);
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function typeBoost(t) {
  if (t === "NEIGHBOURHOOD" || t === "LOCALITY" || t === "ESTATE") return 25;
  if (t === "WARD") return 15;
  if (t === "CONSTITUENCY") return 10;
  if (t === "COUNTY") return 5;
  return 0;
}

function findCandidates(neighborhood, lat, lng) {
  const { place, countyHint } = parsePlace(neighborhood);
  const q = normalizeName(place);
  if (q.length < 2) return [];

  const scored = [];
  const seen = new Set();
  for (const [norm, list] of byNorm) {
    let base = 0;
    if (norm === q) base = 100;
    else if (norm.startsWith(q)) base = 88;
    else if (norm.includes(q) || q.includes(norm)) base = 70;
    else continue;
    for (const loc of list) {
      if (seen.has(loc.id)) continue;
      seen.add(loc.id);
      let score = base + typeBoost(loc.location_type) + (loc.is_official ? 5 : 0);
      if (lat != null && lng != null && loc.latitude != null && loc.longitude != null) {
        const d = haversineKm(lat, lng, loc.latitude, loc.longitude);
        if (d < 5) score += 20;
        else if (d < 20) score += 10;
        else if (d > 80) score -= 25;
      }
      scored.push({ loc, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  let top = scored.slice(0, 8);

  if (countyHint) {
    const hint = normalizeName(countyHint);
    const filtered = top.filter((c) => {
      let p = byId.get(c.loc.parent_id);
      for (let i = 0; i < 4 && p; i++) {
        if (p.normalized_name.includes(hint) || hint.includes(p.normalized_name)) return true;
        p = byId.get(p.parent_id);
      }
      return c.loc.normalized_name.includes(hint);
    });
    if (filtered.length) top = filtered;
  }

  return top;
}

function ancestorsOf(loc) {
  const chain = [];
  let cur = loc;
  const seen = new Set();
  while (cur?.parent_id && !seen.has(cur.parent_id)) {
    seen.add(cur.parent_id);
    const p = byId.get(cur.parent_id);
    if (!p) break;
    chain.push(p);
    cur = p;
  }
  return chain;
}

function pickType(chain, self, type) {
  if (self.location_type === type) return self.id;
  return chain.find((a) => a.location_type === type)?.id ?? null;
}

console.log("Reconciling properties…");
let offset = 0;
for (;;) {
  const { data: rows, error } = await admin
    .from("properties")
    .select("id,neighborhood,latitude,longitude,location_id")
    .order("id", { ascending: true })
    .range(offset, offset + PAGE - 1);
  if (error) throw error;
  if (!rows?.length) break;

  for (const row of rows) {
    report.scanned += 1;
    const neighborhood = row.neighborhood?.trim();
    if (!neighborhood) {
      report.skippedEmpty += 1;
      continue;
    }

    const candidates = findCandidates(neighborhood, row.latitude, row.longitude);
    const best = candidates[0];
    const second = candidates[1];

    if (!best || best.score < 55) {
      report.unmatched += 1;
      await admin
        .from("properties")
        .update({
          location_id: null,
          county_location_id: null,
          constituency_location_id: null,
          ward_location_id: null,
          location_match_confidence: null,
          location_needs_review: true,
        })
        .eq("id", row.id);
      if (report.samples.length < 25) {
        report.samples.push({ id: row.id, neighborhood, status: "unmatched" });
      }
      continue;
    }

    const ambiguous =
      second &&
      second.score >= best.score - 8 &&
      second.loc.name.toLowerCase() !== best.loc.name.toLowerCase();
    const confidence = Math.min(100, Math.round(best.score));
    const needsReview = Boolean(ambiguous) || confidence < 70;
    const chain = ancestorsOf(best.loc);

    const patch = {
      location_id: best.loc.id,
      county_location_id: pickType(chain, best.loc, "COUNTY"),
      constituency_location_id: pickType(chain, best.loc, "CONSTITUENCY"),
      ward_location_id: pickType(chain, best.loc, "WARD"),
      location_match_confidence: confidence,
      location_needs_review: needsReview,
    };

    const { error: upErr } = await admin.from("properties").update(patch).eq("id", row.id);
    if (upErr) throw upErr;

    report.matched += 1;
    if (needsReview) report.needsReview += 1;
    if (report.samples.length < 25) {
      report.samples.push({
        id: row.id,
        neighborhood,
        matched: best.loc.name,
        type: best.loc.location_type,
        confidence,
        needsReview,
      });
    }
  }

  offset += PAGE;
  process.stdout.write(`\r  scanned ${report.scanned}  `);
  if (rows.length < PAGE) break;
}

// Refresh inventory_count on locations from linked active properties
console.log("\nRefreshing inventory counts…");
const { data: counts } = await admin
  .from("properties")
  .select("location_id")
  .eq("is_active", true)
  .not("location_id", "is", null)
  .limit(20000);

const tally = new Map();
for (const r of counts ?? []) {
  if (!r.location_id) continue;
  tally.set(r.location_id, (tally.get(r.location_id) ?? 0) + 1);
}

// Reset then set (batch)
await admin.from("locations").update({ inventory_count: 0 }).gt("inventory_count", 0);
for (const [locationId, count] of tally) {
  await admin.from("locations").update({ inventory_count: count }).eq("id", locationId);
}

const outPath = join(root, "docs", "location-reconcile-report.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("✓ reconcile complete →", outPath);
