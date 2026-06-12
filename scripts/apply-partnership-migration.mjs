/**
 * Apply partnership_inquiries migration via Supabase Management API.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(
  join(root, "supabase", "migrations", "20260612000002_partnership_inquiries.sql"),
  "utf8",
);

function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return { ...env, ...process.env };
}

const env = loadEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
const projectRef = env.SUPABASE_PROJECT_REF;
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!token || !projectRef) {
  console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const probe = await admin.from("partnership_inquiries").select("id").limit(1);
if (!probe.error?.message?.includes("does not exist")) {
  console.log("✓ partnership_inquiries table already exists");
} else {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Management API ${res.status}:`, body.slice(0, 500));
    process.exit(1);
  }
  console.log("✓ partnership_inquiries migration applied");
}
