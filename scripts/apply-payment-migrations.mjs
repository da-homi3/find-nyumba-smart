/**
 * Apply payment-related SQL migrations via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in .env
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

function parseEnv(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

async function runQuery(token, projectRef, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Query failed (${res.status}): ${body.slice(0, 500)}`);
  }
  return body;
}

const MIGRATIONS = [
  "20260615120000_payment_metadata_flutterwave.sql",
  "20260615130000_paystack_subscriptions.sql",
  "20260616120000_pesapal_provider.sql",
];

async function main() {
  if (!existsSync(envPath)) {
    console.error("Missing .env");
    process.exit(1);
  }
  const env = parseEnv(readFileSync(envPath, "utf8"));
  const token = env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF;
  if (!token || !projectRef) {
    console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in .env");
    process.exit(1);
  }

  for (const file of MIGRATIONS) {
    const path = join(root, "supabase", "migrations", file);
    const sql = readFileSync(path, "utf8");
    console.log(`Applying ${file}…`);
    const result = await runQuery(token, projectRef, sql);
    console.log(`  OK`, result ? `(${result.slice(0, 80)}…)` : "");
  }
  console.log("Payment migrations applied.");
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
