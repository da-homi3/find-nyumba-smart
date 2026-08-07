/**
 * Apply 20260805160000_close_pii_exposure.sql, then re-probe with the anon key to prove
 * the exposure is actually closed.
 *
 * Usage: node scripts/apply-pii-lockdown.mjs [--check]
 *   --check  Report preconditions and current anon exposure, apply nothing.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "20260805160000_close_pii_exposure.sql";

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
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 1500)}`);
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/** What anon must NOT be able to read once this migration lands. */
const MUST_BE_BLOCKED = [
  ["profiles", "id,full_name,phone"],
  ["profiles", "id,tenant_plan,lead_pack_balance"],
  ["properties", "id,contact_phone,contact_name"],
];

/** What anon must STILL be able to read, or public browse breaks. */
const MUST_STILL_WORK = [
  ["properties", "id,title,neighborhood,rent_kes,images,is_active"],
  ["properties", "id,latitude,longitude,bedrooms,authenticity_score"],
];

async function fetchAnonRows(url, key, table, select) {
  const res = await fetch(
    `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  const body = await res.text();
  let rows = [];
  if (res.ok) {
    try {
      rows = JSON.parse(body);
    } catch {
      rows = [];
    }
  }
  return { res, body, rows };
}

async function assertBlocked(url, key, table, select) {
  const { res, rows } = await fetchAnonRows(url, key, table, select);
  if (res.ok && rows.length > 0) {
    console.error(`  FAIL  anon can still read ${table} [${select}]`);
    return 1;
  }
  console.log(`  ok    ${table} [${select}] blocked (${res.status})`);
  return 0;
}

async function assertStillReadable(url, key, table, select) {
  const { res, body, rows } = await fetchAnonRows(url, key, table, select);
  if (!res.ok || rows.length === 0) {
    console.error(
      `  FAIL  public browse broke: ${table} [${select}] -> ${res.status} ${body.slice(0, 160)}`,
    );
    return 1;
  }
  console.log(`  ok    ${table} [${select}] still readable`);
  return 0;
}

async function probeAnon(env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  let failures = 0;

  for (const [table, select] of MUST_BE_BLOCKED) {
    failures += await assertBlocked(url, key, table, select);
  }
  for (const [table, select] of MUST_STILL_WORK) {
    failures += await assertStillReadable(url, key, table, select);
  }

  return failures;
}

async function main() {
  const env = loadEnv();
  if (!env.SUPABASE_ACCESS_TOKEN || !env.SUPABASE_PROJECT_REF) {
    console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF");
    process.exit(1);
  }

  const deps = await runQuery(
    env,
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public'
        AND table_name IN ('profiles','properties','inquiries','viewings','organization_members');`,
  );
  const names = new Set((deps ?? []).map((r) => r.table_name));
  const missing = [
    "profiles",
    "properties",
    "inquiries",
    "viewings",
    "organization_members",
  ].filter((t) => !names.has(t));
  if (missing.length > 0) throw new Error(`Missing tables: ${missing.join(", ")}`);
  console.log("✓ dependencies present");

  console.log("\nAnon exposure BEFORE:");
  await probeAnon(env);

  if (process.argv.includes("--check")) {
    console.log("\n--check given, nothing applied.");
    return;
  }

  console.log(`\nApplying ${MIGRATION}…`);
  await runQuery(env, readFileSync(join(root, "supabase", "migrations", MIGRATION), "utf8"));
  console.log("✓ migration applied");

  console.log("\nAnon exposure AFTER:");
  const failures = await probeAnon(env);

  const policies = await runQuery(
    env,
    `SELECT policyname, roles::text AS roles, cmd
       FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
      ORDER BY policyname;`,
  );
  console.log("\nprofiles policies now:");
  for (const p of policies ?? []) console.log(`  ${p.cmd.padEnd(6)} ${p.roles} ${p.policyname}`);

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

try {
  await main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
