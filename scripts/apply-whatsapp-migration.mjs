/**
 * Apply supabase/migrations/20260611120000_whatsapp.sql via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN and SUPABASE_URL in .env
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const sqlPath = join(root, "supabase", "migrations", "20260611120000_whatsapp.sql");

function parseEnv(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function projectRefFromUrl(url) {
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!m) throw new Error(`Cannot parse project ref from SUPABASE_URL: ${url}`);
  return m[1];
}

async function main() {
  if (!existsSync(envPath)) {
    console.error("Missing .env");
    process.exit(1);
  }
  if (!existsSync(sqlPath)) {
    console.error("Missing migration file:", sqlPath);
    process.exit(1);
  }

  const env = parseEnv(readFileSync(envPath, "utf8"));
  const token = env.SUPABASE_ACCESS_TOKEN;
  const url = env.SUPABASE_URL;
  if (!token || !url) {
    console.error("Set SUPABASE_ACCESS_TOKEN and SUPABASE_URL in .env");
    process.exit(1);
  }

  const ref = projectRefFromUrl(url);
  const sql = readFileSync(sqlPath, "utf8");

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("Migration failed:", res.status, body);
    process.exit(1);
  }

  console.log("WhatsApp migration applied successfully.");
  if (body && body !== "[]") console.log(body);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
