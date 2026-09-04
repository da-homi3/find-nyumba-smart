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

/** Canonical place name → aliases landlords actually type (all map to existing rows). */
const ALIAS_MAP = [
  { name: "Gigiri", aliases: ["gigiri un zone", "un zone gigiri", "gigiri un"] },
  { name: "Runda", aliases: ["new runda", "runda kiambu", "runda estate"] },
  { name: "Ngong Road", aliases: ["along ngong road", "ngong rd", "race course ngong"] },
  { name: "Westlands", aliases: ["westland", "waiyaki westlands", "brookside westlands"] },
  {
    name: "Karen",
    aliases: ["karen tangaza", "near tangaza university", "bogani road karen", "bogani karen"],
  },
  { name: "Lavington", aliases: ["lavington area"] },
  { name: "Spring Valley", aliases: ["springvalley"] },
  { name: "Donholm", aliases: ["don holm", "donholm phase"] },
  { name: "Fedha", aliases: ["fedha estate"] },
  { name: "Utawala", aliases: ["utawala shopping mall", "utawala mall"] },
  { name: "Rosslyn", aliases: ["rosslyn lone tree", "roslyn"] },
  { name: "Kasarani", aliases: ["kasarani sunton", "sunton kasarani"] },
  { name: "Kileleshwa", aliases: ["kileleshwa road"] },
  {
    name: "Waiyaki Way",
    aliases: ["along waiyaki way", "waiyaki way", "waiyaki wat", "regen waiyaki way"],
  },
  { name: "Riruta", aliases: ["riruta satellite"] },
  { name: "Peponi Road", aliases: ["peponi", "peponi rd"] },
  { name: "Kitisuru", aliases: ["new kitisuru", "kitisuru estate"] },
  { name: "Ridgeways", aliases: ["ridge way", "ridgeways estate"] },
  { name: "Tatu City", aliases: ["tatu", "tatu city kiambu"] },
  { name: "Bamburi", aliases: ["bamburi mombasa"] },
  { name: "Kamiti Road", aliases: ["kamiti", "along kamiti road"] },
  { name: "Membley", aliases: ["brookview membley", "143 brookview"] },
  { name: "Kinoo", aliases: ["kinoo 87", "along waiyaki way kinoo"] },
  { name: "Uthiru", aliases: ["waiyaki way uthiru"] },
  { name: "Ngumo", aliases: ["ngummo", "ngummo west estate", "ngumo west"] },
  { name: "Nyari", aliases: ["nyari estate"] },
  { name: "Mwihoko", aliases: ["mwihoko estate"] },
  { name: "Ongata Rongai", aliases: ["ongata", "acacia ongata rongai", "laiser hill"] },
  { name: "Rongai", aliases: ["exciting area rongai", "exciting area"] },
  { name: "Kilimani", aliases: ["denis prit", "dennis pritt", "dennis pritt road"] },
  { name: "Spring Valley", aliases: ["grevillea grove", "grevilllea grove"] },
  { name: "Nyari", aliases: ["enaki town", "nyari estate"] },
  { name: "Muguga", aliases: ["kahuru muguga"] },
  { name: "Kangundo Road", aliases: ["saika heights", "kangundo road", "kagundo road", "kagundo"] },
  { name: "Mombasa Road", aliases: ["next gen mall", "enzi heights"] },
  { name: "Malindi", aliases: ["sunpark road malindi", "sunpark road"] },
  {
    name: "Naivasha-Mai Mahiu-Limuru Road",
    aliases: ["naivasha road", "along naivasha road", "naivasha rd"],
  },
  { name: "Kiambu Road", aliases: ["along kiambu road", "thindigua kiambu", "thindigua"] },
];

const env = loadEnv();
const admin = createClient(
  env.SUPABASE_URL ?? env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  },
);

let inserted = 0;
let skipped = 0;
for (const entry of ALIAS_MAP) {
  const preferRoad = /\b(road|way|rd)\b/i.test(entry.name);
  const types = preferRoad
    ? ["ROAD", "NEIGHBOURHOOD", "LOCALITY", "ESTATE", "TOWN", "CITY", "WARD"]
    : ["NEIGHBOURHOOD", "LOCALITY", "ESTATE", "TOWN", "CITY", "WARD", "ROAD"];
  const { data: candidates } = await admin
    .from("locations")
    .select("id,name,location_type")
    .eq("is_active", true)
    .ilike("name", entry.name)
    .in("location_type", types)
    .limit(5);
  const loc =
    (preferRoad ? (candidates ?? []).find((c) => c.location_type === "ROAD") : null) ??
    (candidates ?? [])[0] ??
    null;
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
