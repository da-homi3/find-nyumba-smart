/**
 * Permanently delete seeded demo / E2E / Unsplash-placeholder-only listings.
 * Usage: node scripts/delete-demo-listings.mjs [--dry-run]
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

const MOCK_IDS = [
  "a1000001-0001-4000-8000-000000000001",
  "a1000001-0001-4000-8000-000000000002",
  "a1000001-0001-4000-8000-000000000003",
  "a1000001-0001-4000-8000-000000000004",
];

const KNOWN_DEMO_TITLES = new Set([
  "Bright 2BR near Yaya Centre",
  "Modern studio — Westlands Square",
  "Affordable bedsitter — Kasarani Mwiki",
  "Family 3BR — South B Mugoya",
  "3BR family home — Lavington",
]);

function loadEnv() {
  const env = {};
  for (const path of [join(root, ".env")]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
  return { ...env, ...process.env };
}

function usesOnlyPlaceholders(images, placeholderUrls) {
  const list = images ?? [];
  if (list.length === 0) return false;
  return list.every((url) => placeholderUrls.has(url));
}

function isDemoListing(p, placeholderUrls) {
  if (MOCK_IDS.includes(p.id)) return true;
  if (typeof p.title === "string" && p.title.startsWith("Dashboard E2E")) return true;
  if (KNOWN_DEMO_TITLES.has(p.title)) return true;
  return usesOnlyPlaceholders(p.images, placeholderUrls);
}

async function deleteRelated(admin, ids) {
  // Best-effort cleanup of common dependents before properties delete.
  const tables = [
    "contact_unlocks",
    "inquiry_messages",
    "inquiries",
    "saved_properties",
    "property_reports",
    "property_reviews",
    "viewings",
    "payments",
  ];
  for (const table of tables) {
    try {
      const { error } = await admin.from(table).delete().in("listing_id", ids);
      if (error && !/column|listing_id/i.test(error.message)) {
        // retry with property_id for tables that use that name
        const alt = await admin.from(table).delete().in("property_id", ids);
        if (alt.error && !/column|does not exist|schema cache/i.test(alt.error.message)) {
          console.warn(`  warn ${table}:`, alt.error.message);
        }
      } else if (error && /column|listing_id/i.test(error.message)) {
        const alt = await admin.from(table).delete().in("property_id", ids);
        if (alt.error && !/column|does not exist|schema cache/i.test(alt.error.message)) {
          console.warn(`  warn ${table}:`, alt.error.message);
        }
      }
    } catch (e) {
      console.warn(`  warn ${table}:`, e.message ?? e);
    }
  }
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }

  const placeholders = new Set(
    JSON.parse(readFileSync(join(root, "src/data/listing-placeholders.json"), "utf8")),
  );
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await admin
    .from("properties")
    .select("id, title, images, is_active")
    .limit(5000);
  if (error) throw error;

  const targets = (data ?? []).filter((p) => isDemoListing(p, placeholders));

  console.log(`Total properties scanned: ${(data ?? []).length}`);
  console.log(`Demo / E2E / placeholder listings to DELETE: ${targets.length}`);
  for (const p of targets) {
    console.log(` - [${p.is_active ? "active" : "inactive"}] ${p.id}  ${p.title}`);
  }

  if (dryRun || targets.length === 0) {
    console.log(dryRun ? "Dry run — no changes." : "Nothing to delete.");
    return;
  }

  const ids = targets.map((p) => p.id);
  console.log("Cleaning related rows…");
  await deleteRelated(admin, ids);

  const { error: deleteError } = await admin.from("properties").delete().in("id", ids);
  if (deleteError) throw deleteError;
  console.log(`✓ Permanently deleted ${ids.length} demo listings.`);
}

try {
  await main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
