#!/usr/bin/env node
/**
 * Apply property media upload limit migration to Supabase via Management API.
 * Requires SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in .env
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const sqlPath = join(
  root,
  "supabase",
  "migrations",
  "20260705220000_property_media_upload_limits.sql",
);

function loadEnv() {
  if (!existsSync(envPath)) throw new Error("Missing .env");
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_REF ?? env.VITE_SUPABASE_PROJECT_ID;
if (!token || !ref) {
  console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in .env");
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("Migration failed:", res.status, body);
  process.exit(1);
}

console.log("✓ Property media upload limits applied (500MB images / 900MB videos)");
