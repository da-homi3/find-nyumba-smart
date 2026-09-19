/**
 * Apply get_property_contact RPC + reassert contact column grants.
 * Usage: npm run db:migrate:property-contact-rpc
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
  join(root, "supabase", "migrations", "20260917210000_get_property_contact_rpc.sql"),
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
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 500)}`);
  return body;
}

async function main() {
  const env = loadEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF;
  if (!token || !projectRef) {
    console.log("Paste this SQL in Supabase Dashboard → SQL Editor:\n");
    console.log(MIGRATION_SQL);
    process.exit(1);
  }
  console.log("Applying get_property_contact + column grant reassert…");
  await runManagementQuery(token, projectRef, MIGRATION_SQL);
  const verify = await runManagementQuery(
    token,
    projectRef,
    `
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'properties'
  AND column_name IN ('contact_name', 'contact_phone', 'contact_phones')
  AND grantee IN ('anon', 'authenticated');
`,
  );
  console.log("Contact column privileges for anon/authenticated (expect []): ", verify);
  console.log("Done.");
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
