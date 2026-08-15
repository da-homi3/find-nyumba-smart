/**
 * Apply tenant search profiles + contact_issues.
 * Usage: npm run db:migrate:tenant-profile-score
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
  join(root, "supabase", "migrations", "20260815150000_tenant_profile_score.sql"),
  "utf8",
);

async function tableExists(admin, table, col) {
  const { error } = await admin.from(table).select(col).limit(1);
  return !error || !/schema cache|does not exist|could not find/i.test(error.message ?? "");
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
  if (!token || !projectRef) {
    console.log("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF.");
    process.exit(1);
  }

  const profilesExist = await tableExists(admin, "tenant_search_profiles", "user_id");
  const issuesExist = await tableExists(admin, "contact_issues", "id");
  if (profilesExist && issuesExist) {
    console.log("✓ Tenant profile score tables already exist.");
    return;
  }

  const statements = MIGRATION_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
  console.log(`Applying tenant profile score migration (${statements.length} statements)…`);
  for (const statement of statements) {
    await runManagementQuery(token, projectRef, `${statement};`);
  }
  console.log("✓ Tenant profile score migration applied.");
}

try {
  await main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
