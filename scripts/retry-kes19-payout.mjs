/**
 * Correct KES 19 fee (1%) and send net KES 18 to owner's verified M-Pesa via IntaSend.
 * Usage: node scripts/retry-kes19-payout.mjs
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

async function runQuery(token, projectRef, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${body.slice(0, 800)}`);
  return JSON.parse(body);
}

function intasendBases(env) {
  return (env.INTASEND_ENV || "live").toLowerCase() === "sandbox"
    ? ["https://sandbox.intasend.com/api/v1"]
    : ["https://api.intasend.com/api/v1", "https://payment.intasend.com/api/v1"];
}

function intasendErrorMessage(data, status) {
  if (typeof data?.error === "object" && data.error?.message) return data.error.message;
  if (typeof data?.error === "string") return data.error;
  if (data?.detail) return data.detail;
  if (data?.message) return data.message;
  if (data?.errors)
    return typeof data.errors === "string" ? data.errors : JSON.stringify(data.errors);
  return `IntaSend ${status}`;
}

function transferIdFrom(data) {
  const id = data?.tracking_id || data?.id || data?.transactions?.[0]?.tracking_id || data?.file_id;
  return id ? String(id) : null;
}

async function intasendB2C(env, { phone254, amountKes, batchReference, narration }) {
  const key = env.INTASEND_SECRET_KEY;
  if (!key) throw new Error("INTASEND_SECRET_KEY missing");
  const body = {
    currency: "KES",
    provider: "MPESA-B2C",
    country: "KE",
    requires_approval: "NO",
    batch_reference: batchReference,
    transactions: [
      {
        name: "Landlord",
        account: phone254.replace(/\D/g, ""),
        amount: amountKes,
        narrative: narration.slice(0, 100),
      },
    ],
  };

  let lastErr = null;
  for (const base of intasendBases(env)) {
    const res = await fetch(`${base}/send-money/initiate/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    console.log("IntaSend", base, "status", res.status, JSON.stringify(data).slice(0, 1000));
    if (res.ok) {
      return { data, transferId: transferIdFrom(data) };
    }
    lastErr = new Error(intasendErrorMessage(data, res.status));
    if (res.status === 401 || res.status === 403 || res.status >= 500) continue;
    throw lastErr;
  }
  throw lastErr || new Error("IntaSend B2C failed on all hosts");
}

const env = loadEnv();
const ownerId = "9d7b70a5-a1e8-462e-9d01-edee9bece857";
const paymentId = "4c1ad637-1e19-4891-92f6-c0fe23006d8c";
const destId = "c1f2dfc8-bb7a-4016-af95-0252db72d6d9";
const phone = "254768314076";
const net = 18;
const fee = 1;
const gross = 19;
const required = net + 10;

async function kesAvailable(env) {
  const key = env.INTASEND_SECRET_KEY;
  for (const base of intasendBases(env)) {
    const res = await fetch(`${base}/wallets/`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) continue;
    const data = await res.json().catch(() => null);
    const rows = Array.isArray(data) ? data : data?.results || data?.wallets || [];
    const kes = rows.find((w) => String(w.currency || "").toUpperCase() === "KES");
    if (!kes) continue;
    return Number.parseFloat(String(kes.available_balance ?? 0)) || 0;
  }
  return null;
}

const available = await kesAvailable(env);
console.log("KES available:", available, "required:", required);
if (available == null) {
  console.error("Could not read IntaSend wallet balance");
  process.exit(1);
}
if (available + 0.001 < required) {
  console.error(
    `Wallet still short (available ${available}, need ${required}). Top up at least KES ${(required - available).toFixed(2)} then re-run.`,
  );
  process.exit(2);
}

const batches = await runQuery(
  env.SUPABASE_ACCESS_TOKEN,
  env.SUPABASE_PROJECT_REF,
  `SELECT id, status, total_net_payout, provider_ref, failure_reason, created_at
   FROM pm_payout_batches WHERE owner_user_id = '${ownerId}'
   ORDER BY created_at DESC LIMIT 10`,
);
console.log("Prior batches:", JSON.stringify(batches, null, 2));

await runQuery(
  env.SUPABASE_ACCESS_TOKEN,
  env.SUPABASE_PROJECT_REF,
  `UPDATE pm_platform_fee_ledger
   SET platform_fee = ${fee}, net_payout_amount = ${net}
   WHERE rent_payment_id = '${paymentId}' AND payout_batch_id IS NULL`,
);
console.log("Fee ledger updated to fee=1 net=18");

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: batch, error: batchErr } = await admin
  .from("pm_payout_batches")
  .insert({
    owner_user_id: ownerId,
    payout_destination_id: destId,
    total_gross: gross,
    total_platform_fee: fee,
    total_net_payout: net,
    rent_payment_ids: [paymentId],
    status: "processing",
  })
  .select("id")
  .single();
if (batchErr) throw batchErr;

await admin
  .from("pm_platform_fee_ledger")
  .update({ payout_batch_id: batch.id })
  .eq("rent_payment_id", paymentId);

const batchReference = `nyumba-payout-${batch.id.slice(0, 8)}-${uuid().slice(0, 8)}`;
console.log("Sending IntaSend B2C…", { phone, net, batchReference });

try {
  const sent = await intasendB2C(env, {
    phone254: phone,
    amountKes: net,
    batchReference,
    narration: "NyumbaSearch rent payout",
  });
  console.log("IntaSend OK:", sent.transferId, JSON.stringify(sent.data).slice(0, 400));
  await admin
    .from("pm_payout_batches")
    .update({
      status: "completed",
      provider_ref: sent.transferId,
      failure_reason: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", batch.id);
} catch (e) {
  console.error("IntaSend FAILED:", e.message);
  await admin
    .from("pm_payout_batches")
    .update({ status: "failed", failure_reason: e.message })
    .eq("id", batch.id);
  await admin
    .from("pm_platform_fee_ledger")
    .update({ payout_batch_id: null })
    .eq("rent_payment_id", paymentId);
  process.exit(1);
}

const after = await runQuery(
  env.SUPABASE_ACCESS_TOKEN,
  env.SUPABASE_PROJECT_REF,
  `SELECT f.platform_fee, f.net_payout_amount, f.payout_batch_id, b.status, b.provider_ref, b.failure_reason
   FROM pm_platform_fee_ledger f
   LEFT JOIN pm_payout_batches b ON b.id = f.payout_batch_id
   WHERE f.rent_payment_id = '${paymentId}'`,
);
console.log("Final:", JSON.stringify(after, null, 2));
