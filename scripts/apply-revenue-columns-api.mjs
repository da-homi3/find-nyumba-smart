/**
 * Apply revenue profile/property columns via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF in .env (from `npx supabase login`).
 *
 * Usage: node scripts/apply-revenue-columns-api.mjs
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

const COLUMN_SQL = readFileSync(
  join(root, "supabase", "migrations", "20260612000001_revenue_profile_property_columns.sql"),
  "utf8",
);

async function columnsExist(admin) {
  const prop = await admin.from("properties").select("featured_until").limit(1);
  const prof = await admin.from("profiles").select("landlord_plan").limit(1);
  return {
    properties: !prop.error?.message?.includes("featured_until"),
    profiles: !prof.error?.message?.includes("landlord_plan"),
  };
}

async function runManagementQuery(token, projectRef, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${body.slice(0, 500)}`);
  }
  return body;
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
  const before = await columnsExist(admin);
  if (before.properties && before.profiles) {
    console.log("✓ Revenue columns already exist.");
    return;
  }

  if (!token || !projectRef) {
    console.log("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF.\n");
    console.log("1. Run: npx supabase login");
    console.log("2. Copy the token to .env as SUPABASE_ACCESS_TOKEN");
    console.log("3. Re-run: npm run db:migrate:columns\n");
    console.log("Or paste this SQL in Supabase Dashboard → SQL Editor:\n");
    console.log(COLUMN_SQL);
    process.exit(1);
  }

  console.log("Applying revenue columns via Management API…");
  await runManagementQuery(token, projectRef, COLUMN_SQL);

  const after = await columnsExist(admin);
  if (!after.properties || !after.profiles) {
    console.error("Columns still missing after API call.");
    process.exit(1);
  }
  console.log("✓ Revenue columns applied.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
