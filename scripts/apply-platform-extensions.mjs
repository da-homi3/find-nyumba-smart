/**
 * Apply platform extensions migration (import batches, API keys, WhatsApp, marketing log).
 * Requires SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF in .env (from `npx supabase login`).
 *
 * Usage: npm run db:migrate:platform-extensions
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
  join(root, "supabase", "migrations", "20260618230000_platform_extensions.sql"),
  "utf8",
);

async function migrationApplied(admin) {
  const [batches, apiKeys, waSessions, marketing] = await Promise.all([
    admin.from("import_batches").select("id").limit(1),
    admin.from("integration_api_keys").select("id").limit(1),
    admin.from("whatsapp_sessions").select("id").limit(1),
    admin.from("marketing_email_log").select("id").limit(1),
  ]);
  const ok = (r) => !r.error;
  return {
    importBatches: ok(batches),
    apiKeys: ok(apiKeys),
    whatsappSessions: ok(waSessions),
    marketingLog: ok(marketing),
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
  const before = await migrationApplied(admin);
  if (before.importBatches && before.apiKeys && before.whatsappSessions && before.marketingLog) {
    console.log("✓ Platform extensions migration already applied.");
    return;
  }

  if (!token || !projectRef) {
    console.log("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF.\n");
    console.log("1. Run: npx supabase login");
    console.log("2. Copy the token to .env as SUPABASE_ACCESS_TOKEN");
    console.log("3. Re-run: npm run db:migrate:platform-extensions\n");
    console.log("Or paste this SQL in Supabase Dashboard → SQL Editor:\n");
    console.log(MIGRATION_SQL);
    process.exit(1);
  }

  console.log("Applying platform extensions migration via Management API…");
  await runManagementQuery(token, projectRef, MIGRATION_SQL);

  const after = await migrationApplied(admin);
  if (!after.importBatches || !after.apiKeys || !after.whatsappSessions || !after.marketingLog) {
    console.error("Migration tables still missing after API call.");
    process.exit(1);
  }
  console.log("✓ Platform extensions migration applied.");
}

try {
  await main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
