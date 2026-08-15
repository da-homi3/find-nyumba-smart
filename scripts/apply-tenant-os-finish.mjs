/**
 * Apply tenant OS finish tables (settings, score rules, history, product events, expires_at).
 * Usage: npm run db:migrate:tenant-os-finish
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  join(root, "supabase", "migrations", "20260815160000_tenant_os_finish.sql"),
  "utf8",
);

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
  const token = env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF;
  if (!token || !projectRef) {
    console.log("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF.");
    process.exit(1);
  }

  const statements = MIGRATION_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
  console.log(`Applying tenant OS finish migration (${statements.length} statements)…`);
  for (const statement of statements) {
    await runManagementQuery(token, projectRef, `${statement};`);
  }
  console.log("✓ Tenant OS finish migration applied.");
}

try {
  await main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
