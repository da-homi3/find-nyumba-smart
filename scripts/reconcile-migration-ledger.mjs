/**
 * Reconcile migrations that were historically applied outside Supabase CLI.
 * Dry-run by default. Run only after capturing/validating production metadata:
 *   node scripts/reconcile-migration-ledger.mjs --apply
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apply = process.argv.includes("--apply");

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

async function remoteVersions(token, projectRef) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "select version from supabase_migrations.schema_migrations order by version",
      }),
    },
  );
  if (!response.ok) throw new Error(`Could not read migration ledger (${response.status})`);
  return new Set((await response.json()).map((row) => String(row.version)));
}

function localMigrations() {
  const entries = readdirSync(join(root, "supabase", "migrations"))
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .map((name) => ({ name, version: name.slice(0, 14) }))
    .sort((a, b) => a.version.localeCompare(b.version));
  const counts = new Map();
  for (const entry of entries) counts.set(entry.version, (counts.get(entry.version) ?? 0) + 1);
  const duplicates = [...counts].filter(([, count]) => count > 1).map(([version]) => version);
  if (duplicates.length) throw new Error(`Duplicate migration versions: ${duplicates.join(", ")}`);
  return entries;
}

async function main() {
  const env = loadEnv();
  if (!env.SUPABASE_ACCESS_TOKEN || !env.SUPABASE_PROJECT_REF) {
    throw new Error("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required");
  }
  const remote = await remoteVersions(env.SUPABASE_ACCESS_TOKEN, env.SUPABASE_PROJECT_REF);
  const missing = localMigrations().filter(({ version }) => !remote.has(version));
  if (!missing.length) {
    console.log("Migration ledger is aligned.");
    return;
  }
  console.log(
    `${apply ? "Applying" : "Would apply"} ledger repair for ${missing.length} versions:`,
  );
  console.log(missing.map(({ name }) => `- ${name}`).join("\n"));
  if (!apply) return;

  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  for (let index = 0; index < missing.length; index += 20) {
    const versions = missing.slice(index, index + 20).map(({ version }) => version);
    const result = spawnSync(
      command,
      [
        "--yes",
        "supabase@2.111.0",
        "migration",
        "repair",
        ...versions,
        "--status",
        "applied",
        "--linked",
      ],
      { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
    );
    if (result.status !== 0) throw new Error(`Ledger repair failed for ${versions[0]}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
