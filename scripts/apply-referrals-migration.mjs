/**
 * Apply tenant extended profiles + universal referrals schema.
 * Usage: node scripts/apply-referrals-migration.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = {};
  for (const path of [join(root, ".env"), join(root, ".env.local")]) {
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

const MIGRATIONS = [
  "20260729100000_tenant_extended_profile.sql",
  "20260729110000_universal_referrals.sql",
];

async function main() {
  const env = loadEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF;

  if (!token || !projectRef) {
    console.log("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF.");
    console.log("Paste these SQL files in Supabase Dashboard → SQL Editor:\n");
    for (const file of MIGRATIONS) {
      console.log(`--- ${file} ---`);
      console.log(readFileSync(join(root, "supabase", "migrations", file), "utf8"));
      console.log();
    }
    process.exit(1);
  }

  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(root, "supabase", "migrations", file), "utf8");
    console.log(`Applying ${file}…`);
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 800)}`);
    console.log(`  ✓ ${file} applied`);
  }

  console.log("✓ Tenant profiles + referral system ready.");
}

try {
  await main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
