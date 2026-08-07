/**
 * Definitive anon read-surface audit: enumerate every base table in `public`, then hit
 * each one with the anon (publishable) key and report which return rows. This is the
 * whole attack surface a website visitor sees, not a hand-picked subset. Read-only.
 *
 * Usage: node scripts/audit-anon-full-surface.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

const env = loadEnv();

/** Tables that are legitimately public and expected to return rows to anon. */
const EXPECTED_PUBLIC = new Set([
  "properties", // browse — contact columns already column-revoked
  "property_reviews", // public reviews
  "neighborhood_reviews", // public reviews
  "service_providers", // public directory
  "provider_counties", // directory facets
  "promo_campaigns", // homepage promos
  "pm_pricing_tiers", // public pricing page
]);

async function mgmt(query) {
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
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 800)}`);
  return JSON.parse(body);
}

function parseJsonRows(text) {
  try {
    const rows = JSON.parse(text);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Returns column names when anon can read at least one row; otherwise null. */
async function probeTable(url, key, table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null; // 401/permission denied — blocked, the common case
  const rows = parseJsonRows(await res.text());
  if (rows.length === 0) return null; // readable but empty
  return Object.keys(rows[0]);
}

function logReadable(table, cols) {
  const expected = EXPECTED_PUBLIC.has(table);
  const tag = expected ? "ok  " : "REVIEW";
  const extra = expected ? "" : `  [${cols.join(",")}]`;
  console.log(`${tag}  ${table} -> 1 row, ${cols.length} cols${extra}`);
  return expected;
}

async function main() {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

  const tables = (
    await mgmt(
      `SELECT c.relname FROM pg_class c
        WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
        ORDER BY c.relname;`,
    )
  ).map((r) => r.relname);

  console.log(`Probing ${tables.length} tables with the anon key…\n`);

  const unexpected = [];
  let readable = 0;

  for (const table of tables) {
    const cols = await probeTable(url, key, table);
    if (!cols) continue;
    readable += 1;
    if (!logReadable(table, cols)) unexpected.push({ table, cols });
  }

  console.log(`\n${readable} tables return data to anon (${unexpected.length} unexpected).`);
  if (unexpected.length > 0) {
    console.log("\nReview these — confirm no sensitive column is exposed:");
    for (const u of unexpected) console.log(`  ${u.table}: ${u.cols.join(", ")}`);
    process.exit(1);
  }
  console.log("Anon read surface matches the expected public allow-list.");
}

await main();
