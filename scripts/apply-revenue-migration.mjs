/**
 * Apply revenue migration when SUPABASE_DB_URL has a real password, or verify tables exist.
 * Usage: node scripts/apply-revenue-migration.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

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

async function tablesExist(admin) {
  const checks = ["subscriptions", "listing_boosts", "leads", "rental_transactions", "invoices"];
  const missing = [];
  for (const table of checks) {
    const { error } = await admin.from(table).select("id").limit(1);
    if (error?.message?.includes("does not exist") || error?.code === "42P01") {
      missing.push(table);
    }
  }
  return missing;
}

async function columnsExist(admin) {
  const missing = [];
  const prop = await admin.from("properties").select("featured_until").limit(1);
  if (prop.error?.message?.includes("featured_until")) missing.push("properties.featured_until");
  const prof = await admin.from("profiles").select("landlord_plan").limit(1);
  if (prof.error?.message?.includes("landlord_plan")) missing.push("profiles.landlord_plan");
  return missing;
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  let missingTables = await tablesExist(admin);
  let missingCols = await columnsExist(admin);

  if (missingTables.length === 0 && missingCols.length === 0) {
    console.log("✓ Revenue schema complete (tables + columns).");
    return;
  }

  if (missingTables.length) console.log("Missing tables:", missingTables.join(", "));
  if (missingCols.length) console.log("Missing columns:", missingCols.join(", "));

  const dbUrl = env.SUPABASE_DB_URL ?? "";
  if (dbUrl.includes("[YOUR-PASSWORD]") || !dbUrl.startsWith("postgres")) {
    console.log("\nSet SUPABASE_DB_URL to your real Postgres connection string, then run:");
    console.log("  npm run migrate:local:ps1");
    console.log(
      "\nOr paste supabase/migrations/20260612000000_revenue_model.sql in the Supabase SQL editor.",
    );
    process.exit(1);
  }

  const migrations = [
    join(root, "supabase", "migrations", "20260612000000_revenue_model.sql"),
    join(root, "supabase", "migrations", "20260612000001_revenue_profile_property_columns.sql"),
  ].filter((p) => existsSync(p));

  for (const migration of migrations) {
    console.log(`Applying ${migration} via psql…`);
    execSync(`psql "${dbUrl}" -f "${migration}"`, { stdio: "inherit" });
  }

  missingTables = await tablesExist(admin);
  missingCols = await columnsExist(admin);
  if (missingTables.length || missingCols.length) {
    console.error("Still missing:", [...missingTables, ...missingCols].join(", "));
    process.exit(1);
  }
  console.log("✓ Revenue migration applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
