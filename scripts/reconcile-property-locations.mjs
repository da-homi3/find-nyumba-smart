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

function scrubPlaceNoise(raw) {
  return String(raw ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/^(along|near|off|at|opposite|next to|behind|beside)\s+/i, "")
    .replace(/^\d+[a-z]?\s+/i, "")
    .replace(/\s+(near|opposite|behind|beside|off|along)\s+.+$/i, "")
    .replace(/\s+(shopping\s+mall|stage|roundabout|junction)\b.*$/i, "")
    .replace(/[,;/|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNonPlaceHead(segment) {
  const t = String(segment ?? "").trim();
  if (!t) return true;
  if (/^\d+[a-z]?$/i.test(t)) return true;
  if (/^(plot|house|apt|apartment|flat|unit|door|no|number)\b/i.test(t)) return true;
  const letters = t.replace(/[^a-zA-Z]/g, "");
  return letters.length < 2;
}

const COUNTY_HINTS = new Set([
  "nairobi",
  "nairobi city",
  "kiambu",
  "mombasa",
  "nakuru",
  "kisumu",
  "machakos",
  "kajiado",
  "kilifi",
  "kwale",
  "kitui",
  "nyeri",
  "meru",
  "uasin gishu",
  "kakamega",
]);

function parsePlace(q) {
  const raw = String(q ?? "").trim();
  if (!raw) return { place: "", countyHint: null, alternates: [] };
  const comma = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (comma.length >= 2) {
    let headIdx = 0;
    while (headIdx < comma.length - 1 && isNonPlaceHead(comma[headIdx])) headIdx += 1;
    const head = scrubPlaceNoise(comma[headIdx]);
    const tailParts = comma.slice(headIdx + 1);
    const tailNorm = normalizeName(tailParts.join(" "));
    const countyHint = COUNTY_HINTS.has(tailNorm) ? tailParts.join(" ") : null;
    const place = head || scrubPlaceNoise(raw);
    const alternates = [];
    for (const seg of tailParts) {
      if (isNonPlaceHead(seg)) continue;
      const scrubbed = scrubPlaceNoise(seg);
      if (!scrubbed) continue;
      const norm = normalizeName(scrubbed);
      if (COUNTY_HINTS.has(norm)) continue;
      if (normalizeName(place) === norm) continue;
      alternates.push(scrubbed);
    }
    return { place, countyHint, alternates };
  }
  const scrubbed = scrubPlaceNoise(raw);
  const parts = scrubbed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (COUNTY_HINTS.has(normalizeName(last))) {
      return { place: parts.slice(0, -1).join(" "), countyHint: last, alternates: [] };
    }
    if (parts.length >= 3) {
      const lastTwo = normalizeName(`${parts[parts.length - 2]} ${parts[parts.length - 1]}`);
      if (COUNTY_HINTS.has(lastTwo)) {
        return {
          place: parts.slice(0, -2).join(" "),
          countyHint: `${parts[parts.length - 2]} ${parts[parts.length - 1]}`,
          alternates: [],
        };
      }
    }
  }
  return { place: scrubbed || raw, countyHint: null, alternates: [] };
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
const LOC_TYPES = [
  "NEIGHBOURHOOD",
  "LOCALITY",
  "ESTATE",
  "WARD",
  "CONSTITUENCY",
  "COUNTY",
  "TOWN",
  "CITY",
  "ROAD",
];
const locs = [];
for (let from = 0; ; from += 1000) {
  const { data, error: locErr } = await admin
    .from("locations")
    .select(
      "id,parent_id,name,normalized_name,slug,location_type,latitude,longitude,confidence_score,is_official",
    )
    .eq("is_active", true)
    .in("location_type", LOC_TYPES)
    .order("id", { ascending: true })
    .range(from, from + 999);
  if (locErr) throw locErr;
  const batch = data ?? [];
  locs.push(...batch);
  if (batch.length < 1000) break;
}

const aliases = [];
for (let from = 0; ; from += 1000) {
  const { data, error: aliasErr } = await admin
    .from("location_aliases")
    .select("location_id,normalized_alias")
    .order("id", { ascending: true })
    .range(from, from + 999);
  if (aliasErr) throw aliasErr;
  const batch = data ?? [];
  aliases.push(...batch);
  if (batch.length < 1000) break;
}

const byId = new Map(locs.map((l) => [l.id, l]));
const byNorm = new Map();
for (const l of locs) {
  const list = byNorm.get(l.normalized_name) ?? [];
  list.push(l);
  byNorm.set(l.normalized_name, list);
}
for (const a of aliases) {
  const loc = byId.get(a.location_id);
  if (!loc) continue;
  const list = byNorm.get(a.normalized_alias) ?? [];
  list.push(loc);
  byNorm.set(a.normalized_alias, list);
}
console.log(`  loaded ${locs.length} locations, ${aliases.length} aliases`);

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
  if (t === "ROAD") return 12;
  if (t === "CONSTITUENCY") return 10;
  if (t === "TOWN" || t === "CITY") return 18;
  if (t === "COUNTY") return 5;
  return 0;
}

function findCandidates(neighborhood, lat, lng) {
  const { place, countyHint, alternates } = parsePlace(neighborhood);
  const seeds = [place, ...(alternates ?? [])].map((p) => normalizeName(p)).filter((p) => p.length >= 2);
  if (!seeds.length) return [];

  const scored = [];
  const seen = new Set();
  for (let si = 0; si < seeds.length; si += 1) {
    const primary = seeds[si];
    const seedPenalty = si === 0 ? 0 : 12;
    const variants = [primary];
    const parts = primary.split(" ").filter(Boolean);
    if (parts.length >= 2) variants.push(parts[0]);
    if (parts.length >= 3) variants.push(parts.slice(0, 2).join(" "));

    for (const q of variants) {
      const variantPenalty = q === primary ? 0 : q.split(" ").length === 1 ? 18 : 10;
      for (const [norm, list] of byNorm) {
        let base = 0;
        if (norm === q) base = 100;
        else if (norm.startsWith(q)) base = 88;
        else if (norm.includes(q) || q.includes(norm)) base = 70;
        else continue;
        base = Math.max(0, base - variantPenalty - seedPenalty);
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

async function resolveFromPin(lat, lng) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  try {
    const { data: pip, error } = await admin.rpc("locations_containing_point", { lat, lng });
    if (!error && Array.isArray(pip) && pip.length > 0) {
      const pick = (t) => pip.find((r) => r.location_type === t);
      const hit =
        pick("NEIGHBOURHOOD") ||
        pick("LOCALITY") ||
        pick("ESTATE") ||
        pick("WARD") ||
        pick("CONSTITUENCY") ||
        pick("COUNTY");
      if (hit && byId.has(hit.id)) {
        return { loc: byId.get(hit.id), confidence: 88, method: "polygon" };
      }
      if (hit) {
        return { loc: hit, confidence: 88, method: "polygon" };
      }
    }
  } catch {
    // RPC unavailable — centroid fallback below
  }

  const types = ["NEIGHBOURHOOD", "LOCALITY", "WARD", "ESTATE"];
  let best = null;
  for (const t of types) {
    const d = (t === "WARD" ? 15 : 10) / 111;
    const { data } = await admin
      .from("locations")
      .select(
        "id,parent_id,name,normalized_name,slug,location_type,latitude,longitude,confidence_score,is_official",
      )
      .eq("is_active", true)
      .eq("location_type", t)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .gte("latitude", lat - d)
      .lte("latitude", lat + d)
      .gte("longitude", lng - d)
      .lte("longitude", lng + d)
      .limit(40);
    for (const loc of data ?? []) {
      const dist = haversineKm(lat, lng, loc.latitude, loc.longitude);
      const maxKm = t === "WARD" ? 15 : 10;
      if (dist > maxKm) continue;
      const score = 70 - dist * 3 + typeBoost(t);
      if (!best || score > best.score) best = { loc, score, dist };
    }
  }
  if (!best || best.score < 55) return null;
  return {
    loc: best.loc,
    confidence: Math.min(65, Math.round(best.score)),
    method: "nearest_centroid",
  };
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
    let best = candidates[0];
    let second = candidates[1];

    // Prefer urban places over roads when scores are close.
    const URBAN = new Set(["NEIGHBOURHOOD", "LOCALITY", "ESTATE", "TOWN", "CITY", "WARD"]);
    if (best && !URBAN.has(best.loc.location_type)) {
      const urban = candidates.find((c) => URBAN.has(c.loc.location_type));
      if (urban && urban.score >= best.score - 12) {
        best = urban;
        second = candidates.find((c) => c.loc.id !== urban.loc.id) ?? null;
      }
    }

    if (!best || best.score < 55) {
      // Pin fallback: PostGIS PIP, then nearest ward/locality centroid.
      const pin = await resolveFromPin(row.latitude, row.longitude);
      if (pin) {
        const chain = ancestorsOf(pin.loc);
        const confidence = pin.confidence;
        const needsReview = pin.method !== "polygon" || confidence < 80;
        const patch = {
          location_id: pin.loc.id,
          county_location_id: pickType(chain, pin.loc, "COUNTY"),
          constituency_location_id: pickType(chain, pin.loc, "CONSTITUENCY"),
          ward_location_id: pickType(chain, pin.loc, "WARD"),
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
            matched: pin.loc.name,
            type: pin.loc.location_type,
            confidence,
            needsReview,
            via: pin.method,
          });
        }
        continue;
      }

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
    const needsReview =
      (Boolean(ambiguous) && confidence < 90) || confidence < 70;
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
