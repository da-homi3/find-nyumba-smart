/**
 * Confirm owner payouts for Kilimani G3 rent (KES 19 + KES 10).
 * Usage: node scripts/confirm-owner-payouts.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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
const env = loadEnv();
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const proxyUrl = `${env.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/intasend-proxy`;
const proxySecret = env.INTASEND_PROXY_SECRET || env.CRON_SECRET;
const ownerId = "9d7b70a5-a1e8-462e-9d01-edee9bece857";
const invoiceId = "566374d1-adb9-4eef-bf5a-5c0dd3d5a25d";

console.log("=== Rent payments on invoice ===");
const { data: rents } = await admin
  .from("pm_rent_payments")
  .select("id, amount, mpesa_receipt_number, paid_at, payment_id, note")
  .eq("invoice_id", invoiceId)
  .order("paid_at", { ascending: true });
console.log(JSON.stringify(rents, null, 2));

const rentIds = (rents || []).map((r) => r.id);
console.log("\n=== Fee ledger ===");
const { data: fees } = await admin
  .from("pm_platform_fee_ledger")
  .select(
    "id, rent_payment_id, gross_amount, platform_fee, net_payout_amount, payout_batch_id, created_at",
  )
  .in("rent_payment_id", rentIds.length ? rentIds : ["00000000-0000-0000-0000-000000000000"]);
console.log(JSON.stringify(fees, null, 2));

console.log("\n=== Payout batches (owner) ===");
const { data: batches } = await admin
  .from("pm_payout_batches")
  .select(
    "id, status, total_gross, total_platform_fee, total_net_payout, provider_ref, failure_reason, completed_at, created_at, rent_payment_ids",
  )
  .eq("owner_user_id", ownerId)
  .order("created_at", { ascending: false })
  .limit(15);
console.log(JSON.stringify(batches, null, 2));

console.log("\n=== Destination ===");
const { data: dests } = await admin
  .from("pm_payout_destinations")
  .select("id, destination_type, mpesa_phone, verified, is_active")
  .eq("owner_user_id", ownerId);
console.log(JSON.stringify(dests, null, 2));

console.log("\n=== IntaSend KES wallet ===");
const wres = await fetch(proxyUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${proxySecret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ path: "/wallets/", method: "GET" }),
});
const wtext = await wres.text();
try {
  const data = JSON.parse(wtext);
  const rows = data.results || data;
  const kes = (Array.isArray(rows) ? rows : []).find(
    (w) => String(w.currency || "").toUpperCase() === "KES",
  );
  console.log(
    JSON.stringify(
      kes
        ? {
            wallet_id: kes.wallet_id,
            current: kes.current_balance,
            available: kes.available_balance,
            can_disburse: kes.can_disburse,
          }
        : { raw: wtext.slice(0, 300) },
      null,
      2,
    ),
  );
} catch {
  console.log(wtext.slice(0, 400));
}

const unbatched = (fees || []).filter((f) => !f.payout_batch_id);
const completed = (batches || []).filter((b) => b.status === "completed");
const failed = (batches || []).filter((b) => b.status === "failed");
console.log("\n=== Summary ===");
console.log({
  rentPayments: (rents || []).length,
  feeRows: (fees || []).length,
  unbatchedFees: unbatched.length,
  unbatchedNets: unbatched.map((f) => ({
    rent: f.rent_payment_id,
    net: f.net_payout_amount,
    fee: f.platform_fee,
  })),
  completedBatches: completed.map((b) => ({
    id: b.id,
    net: b.total_net_payout,
    ref: b.provider_ref,
    at: b.completed_at,
  })),
  failedBatches: failed.map((b) => ({
    id: b.id,
    net: b.total_net_payout,
    reason: String(b.failure_reason || "").slice(0, 160),
  })),
});
