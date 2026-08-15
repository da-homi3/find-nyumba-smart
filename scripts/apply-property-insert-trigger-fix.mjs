/**
 * Apply 20260811170000_fix_property_insert_triggers.sql and verify landlord insert.
 * Usage: node scripts/apply-property-insert-trigger-fix.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "20260811170000_fix_property_insert_triggers.sql";

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

async function runQuery(env, query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 1500)}`);
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

const env = loadEnv();
if (!env.SUPABASE_ACCESS_TOKEN || !env.SUPABASE_PROJECT_REF) {
  console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF");
  process.exit(1);
}

console.log(`Applying ${MIGRATION}…`);
await runQuery(env, readFileSync(join(root, "supabase", "migrations", MIGRATION), "utf8"));
console.log("✓ migration applied");

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const password = "NyumbaPortalTest!2026";
const email = "smoke-landlord@nyumbasearch.app";
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const u = list.users.find((x) => x.email === email);
await admin.auth.admin.updateUserById(u.id, { password, email_confirm: true });

const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
await client.auth.signInWithPassword({ email, password });

const id = randomUUID();
const { data, error } = await client
  .from("properties")
  .insert({
    id,
    owner_id: u.id,
    title: `Trigger fix verify ${Date.now()}`,
    property_type: "one_bedroom",
    neighborhood: "Kilimani",
    address: "Test Rd",
    rent_kes: 35000,
    deposit_kes: 70000,
    bedrooms: 1,
    bathrooms: 1,
    is_active: false,
    is_vacant: true,
    amenities: ["Parking"],
    images: [],
  })
  .select("id")
  .single();

if (error) {
  console.error("✗ landlord insert still failing:", error.message);
  process.exit(1);
}
console.log("✓ landlord insert OK", data.id);
await admin.from("properties").delete().eq("id", data.id);
console.log("✓ cleaned up");
