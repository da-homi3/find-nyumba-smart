/**
 * Read-only production metadata backup via the Supabase Management API.
 * Writes no credentials and never reads application table data.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const values = {};
  const path = join(root, ".env");
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 1) continue;
      values[trimmed.slice(0, separator).trim()] = trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
  return { ...values, ...process.env };
}

async function query(token, projectRef, sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase metadata query failed (${response.status})`);
  }
  return response.json();
}

async function main() {
  const env = loadEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF;
  if (!token || !projectRef) {
    throw new Error("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required");
  }

  const [tables, columns, policies, functions, migrations] = await Promise.all([
    query(
      token,
      projectRef,
      `select schemaname, tablename
       from pg_catalog.pg_tables
       where schemaname in ('public', 'storage')
       order by schemaname, tablename`,
    ),
    query(
      token,
      projectRef,
      `select table_schema, table_name, column_name, data_type, is_nullable
       from information_schema.columns
       where table_schema in ('public', 'storage')
       order by table_schema, table_name, ordinal_position`,
    ),
    query(
      token,
      projectRef,
      `select schemaname, tablename, policyname, roles, cmd, qual, with_check
       from pg_catalog.pg_policies
       where schemaname = 'public'
       order by tablename, policyname`,
    ),
    query(
      token,
      projectRef,
      `select n.nspname as schema_name, p.proname as function_name,
              pg_get_function_identity_arguments(p.oid) as arguments,
              p.prosecdef as security_definer, p.proconfig as settings
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
       order by p.proname, arguments`,
    ),
    query(
      token,
      projectRef,
      `select version, name
       from supabase_migrations.schema_migrations
       order by version`,
    ),
  ]);

  const output = {
    capturedAt: new Date().toISOString(),
    projectRef,
    tables,
    columns,
    policies,
    functions,
    migrations,
  };
  const outputPath = join(root, "docs", "_prod-metadata-backup-20260909.json");
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote read-only production metadata backup to ${outputPath}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
