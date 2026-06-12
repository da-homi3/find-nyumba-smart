import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t
    .slice(eq + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const r1 = await admin
  .from("properties")
  .select("id,featured_until,boost_package,nyumba_verified_at")
  .limit(1);
console.log("properties cols:", r1.error?.message ?? "ok");
const r2 = await admin
  .from("profiles")
  .select("landlord_plan,tenant_plan,plus_expires_at")
  .limit(1);
console.log("profiles cols:", r2.error?.message ?? "ok");

const BASE = env.PUBLIC_APP_URL ?? "https://nyumba-search.kevinbuluma1.workers.dev";
const id = r1.data?.[0]?.id;
if (id) {
  const res = await fetch(`${BASE}/tenant/property/${id}`);
  console.log(`GET /tenant/property/${id.slice(0, 8)}…`, res.status);
}
const demo = await fetch(`${BASE}/tenant/property/a1000001-0001-4000-8000-000000000001`);
console.log("GET demo listing", demo.status);
