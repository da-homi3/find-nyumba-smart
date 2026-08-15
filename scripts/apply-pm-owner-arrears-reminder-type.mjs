/**
 * Expand pm_rent_reminder_log reminder_type check for owner digests.
 * Usage: node scripts/apply-pm-owner-arrears-reminder-type.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "20260811181000_pm_owner_arrears_reminder_type.sql";

function loadEnv() {
  const env = {};
  const path = join(root, ".env");
  if (existsSync(path)) {
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

async function runQuery(env, query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${body.slice(0, 1200)}`);
  return body;
}

const env = loadEnv();
if (!env.SUPABASE_ACCESS_TOKEN || !env.SUPABASE_PROJECT_REF) {
  console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF");
  process.exit(1);
}

console.log(`Applying ${MIGRATION}…`);
await runQuery(env, readFileSync(join(root, "supabase", "migrations", MIGRATION), "utf8"));
console.log("✓ applied");
