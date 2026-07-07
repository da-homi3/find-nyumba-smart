/**
 * Seed 127 real Kenyan service providers into Supabase.
 * Usage: npm run db:seed:providers
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { SEED_PROVIDERS } from "./service-provider-seed-data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const env = {};
  for (const path of [join(root, ".env"), join(root, "..", ".env")]) {
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
  return env;
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const probe = await admin.from("service_providers").select("verified, source_url").limit(1);
  if (probe.error?.message?.includes("verified")) {
    console.error("Run npm run db:migrate:service-providers first (verified column missing).");
    process.exit(1);
  }

  console.log(`Seeding ${SEED_PROVIDERS.length} service providers…\n`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const row of SEED_PROVIDERS) {
    const payload = {
      id: row.id,
      user_id: null,
      business_name: row.business_name,
      categories: row.categories,
      areas_served: row.areas_served,
      description: row.description,
      price_range: row.price_range,
      phone: row.phone,
      tier: row.tier,
      status: row.status,
      verified: row.verified,
      source_url: row.source_url,
    };

    const { data: existing } = await admin
      .from("service_providers")
      .select("id")
      .eq("id", row.id)
      .maybeSingle();

    if (existing) {
      const { error } = await admin.from("service_providers").update(payload).eq("id", row.id);
      if (error) {
        console.error(`✗ ${row.business_name}: ${error.message}`);
        failed++;
      } else {
        updated++;
      }
      continue;
    }

    const { error } = await admin.from("service_providers").insert(payload);
    if (error) {
      console.error(`✗ ${row.business_name}: ${error.message}`);
      failed++;
    } else {
      inserted++;
    }
  }

  const verified = SEED_PROVIDERS.filter((r) => r.verified === 1).length;
  console.log(`\nDone: ${inserted} inserted, ${updated} updated, ${failed} failed.`);
  console.log(
    `${verified} with verified phone · ${SEED_PROVIDERS.length - verified} website-only until confirmed.`,
  );
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
