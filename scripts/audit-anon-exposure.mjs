/**
 * Probe what the public (anon) key can read straight off PostgREST, bypassing the
 * column allow-lists the app code uses. Read-only.
 *
 * Usage: node scripts/audit-anon-exposure.mjs
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

const PROBES = [
  ["profiles", "id,full_name,phone"],
  ["profiles", "id,tenant_plan,plus_expires_at,lead_pack_balance,trial_unlocks_remaining"],
  ["properties", "id,contact_phone,contact_name"],
  ["properties", "id,owner_id"],
  ["contact_unlocks", "id,user_id,listing_id"],
  ["inquiries", "id,tenant_id,landlord_id"],
  ["payments", "id,amount_kes,user_id"],
  ["user_roles", "user_id,role"],
  ["viewings", "id,tenant_id,landlord_id"],
  ["leads", "id"],
];

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY");
    process.exit(1);
  }

  console.log(`Probing ${url} with the ANON key (what any website visitor can do)\n`);
  let exposed = 0;

  for (const [table, select] of PROBES) {
    const endpoint = `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=3`;
    const res = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const body = await res.text();

    if (res.ok) {
      let rows;
      try {
        rows = JSON.parse(body);
      } catch {
        rows = [];
      }
      if (Array.isArray(rows) && rows.length > 0) {
        exposed += 1;
        console.log(`EXPOSED  ${table} [${select}] -> ${rows.length} row(s)`);
        console.log(`         sample: ${JSON.stringify(rows[0]).slice(0, 220)}`);
      } else {
        console.log(`ok       ${table} [${select}] -> 0 rows`);
      }
    } else {
      const short = body.replace(/\s+/g, " ").slice(0, 120);
      console.log(`blocked  ${table} [${select}] -> ${res.status} ${short}`);
    }
  }

  // Total row count is the clearest signal of a blanket-true policy.
  const countRes = await fetch(`${url}/rest/v1/profiles?select=id`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  console.log(`\nprofiles rows visible to anon: ${countRes.headers.get("content-range") ?? "n/a"}`);
  console.log(`${exposed} of ${PROBES.length} probes returned data.`);
}

await main();
