/**
 * Apply 20260805120000_security_and_integrity_hardening.sql to the linked project.
 *
 * Migrations here are applied through the Management API rather than `supabase db push`,
 * because the remote migration history table is not the source of truth for this project.
 *
 * Usage: node scripts/apply-security-hardening.mjs [--check]
 *   --check  Report preconditions and exit without writing anything.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "20260805120000_security_and_integrity_hardening.sql";

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

const SQL = readFileSync(join(root, "supabase", "migrations", MIGRATION), "utf8");

/** Every table the migration touches. A missing one rolls the whole batch back. */
const REQUIRED_TABLES = [
  "pm_payout_batches",
  "pm_platform_fee_ledger",
  "pm_leases",
  "pm_rent_invoices",
  "profiles",
  "properties",
  "verifications",
  "subscriptions",
  "listing_boosts",
  "invoices",
  "payment_webhook_log",
  "property_views",
  "admin_audit_logs",
  "portal_applications",
  "pm_tenants",
  "payments",
];

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
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 1200)}`);
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

async function preflight(env) {
  const tableList = REQUIRED_TABLES.map((t) => `'${t}'`).join(", ");
  const present = await runQuery(
    env,
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (${tableList});`,
  );
  const names = new Set((present ?? []).map((r) => r.table_name));
  const missing = REQUIRED_TABLES.filter((t) => !names.has(t));
  if (missing.length > 0) {
    throw new Error(`Missing tables, migration would roll back: ${missing.join(", ")}`);
  }
  console.log(`✓ all ${REQUIRED_TABLES.length} referenced tables exist`);

  // The unique indexes below cannot be built over existing duplicates. The migration
  // downgrades that to a warning, so surface the counts here instead of silently skipping.
  const dupes = await runQuery(
    env,
    `SELECT 'mpesa_receipt' AS ref, COUNT(*) AS dupes FROM (
       SELECT mpesa_receipt FROM public.payments
       WHERE mpesa_receipt IS NOT NULL AND mpesa_receipt <> ''
       GROUP BY mpesa_receipt HAVING COUNT(*) > 1
     ) d
     UNION ALL
     SELECT 'mpesa_checkout_id', COUNT(*) FROM (
       SELECT mpesa_checkout_id FROM public.payments
       WHERE mpesa_checkout_id IS NOT NULL
       GROUP BY mpesa_checkout_id HAVING COUNT(*) > 1
     ) d
     UNION ALL
     SELECT 'idempotency_key', COUNT(*) FROM (
       SELECT idempotency_key FROM public.payments
       WHERE idempotency_key IS NOT NULL
       GROUP BY idempotency_key HAVING COUNT(*) > 1
     ) d;`,
  );
  for (const row of dupes ?? []) {
    const n = Number(row.dupes);
    if (n > 0) {
      console.warn(
        `! payments.${row.ref}: ${n} duplicated value(s) — unique index will be skipped`,
      );
    } else {
      console.log(`✓ payments.${row.ref} has no duplicates`);
    }
  }
}

async function verify(env) {
  const checks = await runQuery(
    env,
    `SELECT
       (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema='public' AND table_name='pm_platform_fee_ledger'
           AND column_name='reversed_at') AS reversed_at_col,
       (SELECT COUNT(*) FROM pg_trigger
         WHERE tgname='guard_property_trust_columns' AND NOT tgisinternal) AS trust_trigger,
       (SELECT COUNT(*) FROM pg_indexes
         WHERE schemaname='public' AND indexname LIKE 'idx_payments_%_unique') AS payment_uniques,
       (SELECT COUNT(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='verifications') AS verification_policies;`,
  );
  console.log("post-apply state:", checks?.[0] ?? checks);
}

async function main() {
  const env = loadEnv();
  if (!env.SUPABASE_ACCESS_TOKEN || !env.SUPABASE_PROJECT_REF) {
    console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF");
    process.exit(1);
  }

  console.log(`Preflight for ${MIGRATION}…`);
  await preflight(env);

  if (process.argv.includes("--check")) {
    console.log("--check given, nothing applied.");
    return;
  }

  console.log("Applying migration…");
  await runQuery(env, SQL);
  console.log("✓ migration applied");
  await verify(env);
}

try {
  await main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
