/**
 * Drop the active-listing fingerprint unique index so same-named units can coexist.
 * Usage: node scripts/apply-allow-duplicate-listing-names.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

const MIGRATION_SQL = readFileSync(
  join(root, "supabase", "migrations", "20260719190000_allow_duplicate_listing_names.sql"),
  "utf8",
);

async function main() {
  const env = loadEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF;

  if (!token || !projectRef) {
    console.log("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF.");
    console.log("Paste this SQL in Supabase Dashboard → SQL Editor:\n");
    console.log(MIGRATION_SQL);
    process.exit(1);
  }

  console.log("Dropping active duplicate_hash unique index…");
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: MIGRATION_SQL }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 500)}`);
  console.log("✓ Same-named / matching-fingerprint listings can now stay active together.");
}

try {
  await main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
