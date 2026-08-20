/**
 * Deduplicate Murang'a county rows; keep county:murang a (matches countyLookupKey).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

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

const env = loadEnv();
const admin = createClient(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const KEEP = "county:murang a";
const DROP = "county:muranga";

const { data: rows } = await admin
  .from("locations")
  .select("id,source_id")
  .eq("location_type", "COUNTY")
  .eq("source", "iebc-hierarchy-stevehoober254")
  .in("source_id", [KEEP, DROP]);

const keep = rows?.find((r) => r.source_id === KEEP);
const drop = rows?.find((r) => r.source_id === DROP);
if (!keep || !drop) {
  console.log("Nothing to merge", { keep, drop });
  process.exit(0);
}

console.log("Reparenting children from", drop.id, "→", keep.id);
await admin.from("locations").update({ parent_id: keep.id }).eq("parent_id", drop.id);
await admin.from("properties").update({ county_location_id: keep.id }).eq("county_location_id", drop.id);
await admin.from("properties").update({ location_id: keep.id }).eq("location_id", drop.id);
await admin.from("location_aliases").delete().eq("location_id", drop.id);
const { error } = await admin.from("locations").delete().eq("id", drop.id);
if (error) throw error;
console.log("✓ merged Murang'a duplicate");
