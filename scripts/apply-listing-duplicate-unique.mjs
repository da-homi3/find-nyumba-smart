/**
 * Apply DB-level unique constraint for active listing fingerprints.
 * Deactivates duplicate active listings (keeps oldest) then adds partial unique index.
 * Usage: npm run db:migrate:dedupe-unique
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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
  join(root, "supabase", "migrations", "20260708130000_listing_duplicate_unique_constraint.sql"),
  "utf8",
);

async function runManagementQuery(token, projectRef, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 500)}`);
  return body;
}

async function countActiveDuplicateGroups(admin) {
  const { data, error } = await admin
    .from("properties")
    .select("duplicate_hash")
    .eq("is_active", true)
    .not("duplicate_hash", "is", null);
  if (error) throw error;

  const counts = new Map();
  for (const row of data ?? []) {
    counts.set(row.duplicate_hash, (counts.get(row.duplicate_hash) ?? 0) + 1);
  }
  let groups = 0;
  let extras = 0;
  for (const count of counts.values()) {
    if (count > 1) {
      groups += 1;
      extras += count - 1;
    }
  }
  return { groups, extras };
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const token = env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF;

  if (!url || !key) {
    console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const before = await countActiveDuplicateGroups(admin);
  if (before.groups > 0) {
    console.log(
      `Found ${before.groups} duplicate fingerprint group(s) (${before.extras} extra active listing(s) will be deactivated).`,
    );
  }

  if (!token || !projectRef) {
    console.log("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF.");
    console.log("Paste this SQL in Supabase Dashboard → SQL Editor:\n");
    console.log(MIGRATION_SQL);
    process.exit(1);
  }

  console.log("Applying listing duplicate unique constraint…");
  await runManagementQuery(token, projectRef, MIGRATION_SQL);

  const after = await countActiveDuplicateGroups(admin);
  if (after.groups > 0) {
    console.error("Duplicate active fingerprints remain after migration:", after);
    process.exit(1);
  }

  console.log("✓ Active listing fingerprints are now unique at the database level.");
}

try {
  await main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
