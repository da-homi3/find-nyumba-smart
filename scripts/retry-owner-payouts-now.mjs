/**
 * Retry unbatched owner payouts via IntaSend proxy (combined when possible).
 * Usage: node scripts/retry-owner-payouts-now.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { randomUUID as uuid } from "node:crypto";

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
const destId = "c1f2dfc8-bb7a-4016-af95-0252db72d6d9";
const phone = "254768314076";

async function proxy(path, method, body) {
  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${proxySecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path, method, body }),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, text, data };
}

const w = await proxy("/wallets/", "GET");
const rows = w.data?.results || w.data || [];
const kes = (Array.isArray(rows) ? rows : []).find(
  (x) => String(x.currency || "").toUpperCase() === "KES",
);
const available = Number.parseFloat(String(kes?.available_balance ?? 0)) || 0;
console.log("KES available", available);

const { data: fees } = await admin
  .from("pm_platform_fee_ledger")
  .select("*")
  .eq("owner_user_id", ownerId)
  .is("payout_batch_id", null)
  .gt("net_payout_amount", 0)
  .order("created_at", { ascending: true });

if (!fees?.length) {
  console.log("No unbatched fees");
  process.exit(0);
}

const totalNet = fees.reduce((s, f) => s + Number(f.net_payout_amount), 0);
console.log(
  "Unbatched",
  fees.map((f) => ({ rent: f.rent_payment_id, net: f.net_payout_amount })),
  "totalNet",
  totalNet,
);

// Prefer sending everything if wallet covers net+10; else largest fee that fits >=10.
const charge = 10;
let selected = fees;
if (available + 0.001 < totalNet + charge) {
  selected = [];
  // Greedy: take oldest fees while under budget and keep net >= 10 when possible
  let running = 0;
  for (const f of fees) {
    const n = Number(f.net_payout_amount);
    if (running + n + charge <= available + 0.001) {
      selected.push(f);
      running += n;
    }
  }
  if (selected.length === 0) {
    // Try single largest fee that fits
    const fit = [...fees]
      .sort((a, b) => Number(b.net_payout_amount) - Number(a.net_payout_amount))
      .find(
        (f) =>
          Number(f.net_payout_amount) >= 10 &&
          Number(f.net_payout_amount) + charge <= available + 0.001,
      );
    if (fit) selected = [fit];
  }
}

const sendNet = selected.reduce((s, f) => s + Number(f.net_payout_amount), 0);
const sendFee = selected.reduce((s, f) => s + Number(f.platform_fee), 0);
const sendGross = selected.reduce((s, f) => s + Number(f.gross_amount), 0);
console.log(
  "Sending",
  selected.map((f) => f.rent_payment_id),
  "net",
  sendNet,
);

if (sendNet < 10) {
  console.error(
    `Cannot send yet — M-Pesa minimum KES 10 (selected net ${sendNet}). Wallet ${available}.`,
  );
  process.exit(2);
}
if (available + 0.001 < sendNet + charge) {
  console.error(`Wallet short: need ~${sendNet + charge}, have ${available}`);
  process.exit(2);
}

const { data: batch, error: batchErr } = await admin
  .from("pm_payout_batches")
  .insert({
    owner_user_id: ownerId,
    payout_destination_id: destId,
    total_gross: sendGross,
    total_platform_fee: sendFee,
    total_net_payout: sendNet,
    rent_payment_ids: selected.map((f) => f.rent_payment_id),
    status: "processing",
  })
  .select("id")
  .single();
if (batchErr) throw batchErr;

await admin
  .from("pm_platform_fee_ledger")
  .update({ payout_batch_id: batch.id })
  .in(
    "id",
    selected.map((f) => f.id),
  );

const batchReference = `nyumba-payout-${batch.id.slice(0, 8)}-${uuid().slice(0, 8)}`;
const sent = await proxy("/send-money/initiate/", "POST", {
  currency: "KES",
  provider: "MPESA-B2C",
  country: "KE",
  requires_approval: "NO",
  batch_reference: batchReference,
  transactions: [
    {
      name: "Landlord",
      account: phone,
      amount: sendNet,
      narrative: "NyumbaSearch rent payout",
    },
  ],
});
console.log("IntaSend", sent.status, sent.text.slice(0, 500));

if (!sent.ok) {
  await admin
    .from("pm_payout_batches")
    .update({
      status: "failed",
      failure_reason: sent.text.slice(0, 500),
    })
    .eq("id", batch.id);
  await admin
    .from("pm_platform_fee_ledger")
    .update({ payout_batch_id: null })
    .eq("payout_batch_id", batch.id);
  process.exit(1);
}

const transferId =
  sent.data?.tracking_id ||
  sent.data?.id ||
  sent.data?.transactions?.[0]?.tracking_id ||
  batchReference;

await admin
  .from("pm_payout_batches")
  .update({
    status: "completed",
    provider_ref: String(transferId),
    failure_reason: null,
    completed_at: new Date().toISOString(),
  })
  .eq("id", batch.id);

console.log("Completed batch", batch.id, "ref", transferId, "net", sendNet, "to", phone);

const left = fees.filter((f) => !selected.some((s) => s.id === f.id));
if (left.length) {
  console.log(
    "Still queued:",
    left.map((f) => ({ rent: f.rent_payment_id, net: f.net_payout_amount })),
  );
}
