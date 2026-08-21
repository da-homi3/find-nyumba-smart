/**
 * Refresh locations.inventory_count from active properties (FK + text fallback).
 * Usage: node scripts/refresh-location-inventory.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

const env = loadEnv();
const admin = createClient(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const counts = new Map();
function bump(id, n = 1) {
  if (!id) return;
  counts.set(id, (counts.get(id) ?? 0) + n);
}

const PAGE = 500;
let from = 0;
let scanned = 0;
for (;;) {
  const { data, error } = await admin
    .from("properties")
    .select(
      "id,neighborhood,location_id,ward_location_id,constituency_location_id,county_location_id,is_active",
    )
    .eq("is_active", true)
    .range(from, from + PAGE - 1);
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) break;
  for (const row of rows) {
    scanned += 1;
    bump(row.location_id);
    bump(row.ward_location_id);
    bump(row.constituency_location_id);
    bump(row.county_location_id);
  }
  if (rows.length < PAGE) break;
  from += PAGE;
}

// Text fallback for properties with no location_id but a neighborhood label.
const { data: urban } = await admin
  .from("locations")
  .select("id,normalized_name,location_type")
  .eq("is_active", true)
  .in("location_type", ["LOCALITY", "NEIGHBOURHOOD", "ESTATE", "TOWN", "CITY", "WARD"]);

const byNorm = new Map();
for (const loc of urban ?? []) {
  const key = normalizeName(loc.normalized_name || "");
  if (!key) continue;
  if (!byNorm.has(key)) byNorm.set(key, loc.id);
}

from = 0;
let textMatched = 0;
for (;;) {
  const { data, error } = await admin
    .from("properties")
    .select("id,neighborhood,location_id")
    .eq("is_active", true)
    .is("location_id", null)
    .not("neighborhood", "is", null)
    .range(from, from + PAGE - 1);
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) break;
  for (const row of rows) {
    const place = String(row.neighborhood ?? "").split(",")[0]?.trim() ?? "";
    const key = normalizeName(place);
    const id = byNorm.get(key);
    if (id) {
      bump(id);
      textMatched += 1;
    }
  }
  if (rows.length < PAGE) break;
  from += PAGE;
}

// Reset then write via Management API when available; else batched updates.
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_REF ?? env.VITE_SUPABASE_PROJECT_ID;
let updated = 0;

if (token && ref) {
  const reset = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "UPDATE public.locations SET inventory_count = 0" }),
  });
  if (!reset.ok) {
    console.warn("reset failed", await reset.text().then((t) => t.slice(0, 200)));
  }

  const entries = [...counts.entries()];
  for (let i = 0; i < entries.length; i += 40) {
    const chunk = entries.slice(i, i + 40);
    const values = chunk.map(([id, c]) => `('${id}'::uuid, ${c})`).join(",");
    const sql = `
      UPDATE public.locations AS l
      SET inventory_count = v.c, updated_at = now()
      FROM (VALUES ${values}) AS v(id, c)
      WHERE l.id = v.id
    `;
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    if (!res.ok) {
      console.warn("batch fail", await res.text().then((t) => t.slice(0, 200)));
    } else {
      updated += chunk.length;
    }
  }
} else {
  // Slow path: per-row updates (no token).
  await admin.from("locations").update({ inventory_count: 0 }).neq("id", "00000000-0000-0000-0000-000000000000");
  for (const [id, c] of counts) {
    const { error } = await admin.from("locations").update({ inventory_count: c }).eq("id", id);
    if (!error) updated += 1;
  }
}

const report = {
  scannedActiveProperties: scanned,
  locationsWithInventory: counts.size,
  textMatchedWithoutFk: textMatched,
  rowsUpdated: updated,
  top: [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id, count]) => ({ id, count })),
};

writeFileSync(join(root, "docs", "location-inventory-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("✓ location inventory refreshed");
