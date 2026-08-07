/**
 * Apply a single migration file by name through the Supabase Management API.
 *
 * This project does not use `supabase db push`: the remote migration history table is not
 * the source of truth, so a push would try to replay migrations that are already applied.
 *
 * Usage: node scripts/apply-migration.mjs <migration-file-name.sql>
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

const name = process.argv[2];
if (!name) {
  console.error("Usage: node scripts/apply-migration.mjs <migration-file-name.sql>");
  process.exit(1);
}

const file = join(root, "supabase", "migrations", name);
if (!existsSync(file)) {
  console.error(`Not found: ${file}`);
  process.exit(1);
}

const env = loadEnv();
if (!env.SUPABASE_ACCESS_TOKEN || !env.SUPABASE_PROJECT_REF) {
  console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF");
  process.exit(1);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: readFileSync(file, "utf8") }),
  },
);

const body = await res.text();
if (!res.ok) {
  console.error(`Management API ${res.status}: ${body.slice(0, 1500)}`);
  process.exit(1);
}
console.log(`✓ applied ${name}`);
