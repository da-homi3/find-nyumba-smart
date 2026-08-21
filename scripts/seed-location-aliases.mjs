/**
 * Upsert verified aliases for existing locations only (no invented places).
 * Usage: node scripts/seed-location-aliases.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
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

/** Canonical place name → aliases landlords actually type (all map to existing rows). */
const ALIAS_MAP = [
  { name: "Gigiri", aliases: ["gigiri un zone", "un zone gigiri", "gigiri un"] },
  { name: "Runda", aliases: ["new runda", "runda kiambu", "runda estate"] },
  { name: "Ngong Road", aliases: ["along ngong road", "ngong rd", "race course ngong"] },
  { name: "Westlands", aliases: ["westland", "waiyaki westlands"] },
  { name: "Karen", aliases: ["karen tangaza", "near tangaza university"] },
  { name: "Lavington", aliases: ["lavington area"] },
  { name: "Spring Valley", aliases: ["springvalley"] },
  { name: "Donholm", aliases: ["don holm", "donholm phase"] },
  { name: "Fedha", aliases: ["fedha estate"] },
  { name: "Utawala", aliases: ["utawala shopping mall", "utawala mall"] },
  { name: "Rosslyn", aliases: ["rosslyn lone tree", "roslyn"] },
  { name: "Kasarani", aliases: ["kasarani sunton", "sunton kasarani"] },
  { name: "Kileleshwa", aliases: ["kileleshwa road"] },
];

const env = loadEnv();
const admin = createClient(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let inserted = 0;
let skipped = 0;
for (const entry of ALIAS_MAP) {
  const { data: loc } = await admin
    .from("locations")
    .select("id,name")
    .eq("is_active", true)
    .ilike("name", entry.name)
    .in("location_type", ["NEIGHBOURHOOD", "LOCALITY", "ESTATE", "TOWN"])
    .limit(1)
    .maybeSingle();
  if (!loc) {
    console.warn("skip missing place", entry.name);
    skipped += 1;
    continue;
  }
  for (const alias of entry.aliases) {
    const { error } = await admin.from("location_aliases").upsert(
      {
        location_id: loc.id,
        alias,
        normalized_alias: normalizeName(alias),
        alias_kind: "colloquial",
      },
      { onConflict: "location_id,normalized_alias" },
    );
    if (error) {
      // Unique on normalized_alias alone may differ by schema — try insert ignore.
      const { error: insErr } = await admin.from("location_aliases").insert({
        location_id: loc.id,
        alias,
        normalized_alias: normalizeName(alias),
        alias_kind: "colloquial",
      });
      if (insErr) console.warn(entry.name, alias, insErr.message);
      else inserted += 1;
    } else {
      inserted += 1;
    }
  }
}

console.log(JSON.stringify({ inserted, skippedMissingCanonical: skipped }, null, 2));
