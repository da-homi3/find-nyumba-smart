/**
 * Seed revenue demo data (subscriptions, boosts, leads).
 * Usage: node scripts/seed-revenue.mjs
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  }
  return env;
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const env = loadEnv();
const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log("Seeding revenue demo data…\n");

  const { data: landlords } = await admin.from("profiles").select("id").limit(3);
  const { data: tenants } = await admin.from("profiles").select("id").limit(5);
  const { data: properties } = await admin
    .from("properties")
    .select("id, owner_id")
    .eq("is_active", true)
    .limit(5);

  if (!landlords?.length || !properties?.length) {
    console.log("Need profiles and properties in DB first. Skipping.");
    return;
  }

  const plans = ["pro", "pro", "premium"];
  for (let i = 0; i < Math.min(3, landlords.length); i++) {
    const plan = plans[i];
    await admin.from("subscriptions").insert({
      user_id: landlords[i].id,
      plan,
      status: "active",
      amount_kes: plan === "premium" ? 2499 : 999,
      billing_cycle: "monthly",
      payment_method: "mpesa",
      next_billing_date: addDays(30),
    });
    console.log(`✓ Landlord ${landlords[i].id.slice(0, 8)} → ${plan} subscription`);
  }

  if (tenants?.length >= 2) {
    for (const t of tenants.slice(0, 2)) {
      await admin.from("subscriptions").insert({
        user_id: t.id,
        plan: "plus",
        status: "active",
        amount_kes: 499,
        billing_cycle: "monthly",
        payment_method: "mpesa",
        next_billing_date: addDays(30),
      });
      console.log(`✓ Tenant ${t.id.slice(0, 8)} → Plus subscription`);
    }
  }

  const boostEnd = addDays(14);
  for (const prop of properties.slice(0, 2)) {
    await admin.from("listing_boosts").insert({
      listing_id: prop.id,
      user_id: prop.owner_id,
      package: "spotlight",
      end_date: boostEnd,
      amount_paid_kes: 2000,
      placements: ["search-top"],
    });
    console.log(`✓ Boost on property ${prop.id.slice(0, 8)}`);
  }

  const tenantId = tenants?.[0]?.id;
  const landlordId = properties[0].owner_id;
  if (tenantId && landlordId) {
    const sources = ["save", "message", "view", "booking"];
    for (const source of sources) {
      await admin.from("leads").upsert(
        {
          listing_id: properties[0].id,
          landlord_id: landlordId,
          tenant_id: tenantId,
          source,
          quality_score: 4,
        },
        { onConflict: "listing_id,tenant_id,source", ignoreDuplicates: true },
      );
    }
    console.log("✓ Sample leads");
  }

  if (properties[0] && landlordId) {
    await admin.from("rental_transactions").insert({
      listing_id: properties[0].id,
      landlord_id: landlordId,
      rent_amount_kes: 45000,
      platform_fee_kes: 2250,
      status: "pending",
    });
    console.log("✓ Sample rental transaction");
  }

  await admin.from("verification_requests").insert({
    property_address: "Demo verified listing",
    listing_id: properties[0].id,
    requester_name: "Demo Landlord",
    requester_phone: "+254700000000",
    requester_email: "demo@nyumbasearch.app",
    tier: "standard",
    amount_paid_kes: 3500,
    status: "complete",
  });
  console.log("✓ Verification badge on one listing");

  console.log("\nRevenue seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
