/**
 * Deactivate seeded demo / Unsplash-placeholder-only listings.
 * Usage: node scripts/deactivate-demo-listings.mjs [--dry-run]
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
  // Prefer explicit seed/demo signals; empty images alone may be incomplete real uploads.
  if (list.length === 0) return false;
  return list.every((url) => placeholderUrls.has(url));
}

function isDemoListing(p, placeholderUrls) {
  if (MOCK_IDS.includes(p.id)) return true;
  if (typeof p.title === "string" && p.title.startsWith("Dashboard E2E")) return true;
  return usesOnlyPlaceholders(p.images, placeholderUrls);
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
    .eq("is_active", true)
    .limit(2000);
  if (error) throw error;

  const targets = (data ?? []).filter((p) => isDemoListing(p, placeholders));

  console.log(`Active listings: ${(data ?? []).length}`);
  console.log(`Demo / placeholder-only to deactivate: ${targets.length}`);
  for (const p of targets.slice(0, 50)) {
    console.log(` - ${p.id}  ${p.title}`);
  }
  if (targets.length > 50) console.log(` ... and ${targets.length - 50} more`);

  if (dryRun || targets.length === 0) {
    console.log(dryRun ? "Dry run — no changes." : "Nothing to deactivate.");
    return;
  }

  const ids = targets.map((p) => p.id);
  const { error: updateError } = await admin
    .from("properties")
    .update({ is_active: false })
    .in("id", ids);
  if (updateError) throw updateError;
  console.log(`✓ Deactivated ${ids.length} demo / placeholder listings.`);
}

try {
  await main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
