/**
 * Apply the reviewed health/security migration through Supabase Management API.
 * The SQL is transactional; migration history is repaired separately with Supabase CLI.
 */
import { existsSync, readFileSync } from "node:fs";
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

async function main() {
  const env = loadEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF;
  if (!token || !projectRef) {
    throw new Error("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required");
  }
  const sql = readFileSync(
    join(root, "supabase", "migrations", "20260909110000_health_security_hardening.sql"),
    "utf8",
  );
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: `BEGIN;\n${sql}\nCOMMIT;` }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Health/security migration failed (${response.status}): ${(await response.text()).slice(0, 500)}`,
    );
  }
  console.log("Applied reviewed health/security migration transaction.");
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
