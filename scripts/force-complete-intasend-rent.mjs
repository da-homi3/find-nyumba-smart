/**
 * Settle pending IntaSend rent payments already COMPLETE at the provider.
 * Usage: node scripts/force-complete-intasend-rent.mjs
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

async function intasendStatus(invoiceId) {
  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${proxySecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: "/payment/status/",
      method: "POST",
      body: { invoice_id: invoiceId },
    }),
  });
  const text = await res.text();
  const data = JSON.parse(text);
  return {
    ok: res.ok,
    state: String(data?.invoice?.state || "").toUpperCase(),
    mpesaRef: data?.invoice?.mpesa_reference || null,
    raw: text,
  };
}

async function loadOwnerProperty(invoiceId) {
  const { data: inv } = await admin
    .from("pm_rent_invoices")
    .select("id, amount_due, amount_paid, status, lease_id, late_fee, due_date, paid_at")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return null;
  const { data: lease } = await admin
    .from("pm_leases")
    .select("unit_id")
    .eq("id", inv.lease_id)
    .maybeSingle();
  const { data: unit } = lease
    ? await admin.from("pm_units").select("property_id").eq("id", lease.unit_id).maybeSingle()
    : { data: null };
  const { data: property } = unit
    ? await admin
        .from("pm_properties")
        .select("id, owner_user_id")
        .eq("id", unit.property_id)
        .maybeSingle()
    : { data: null };
  return { inv, property };
}

const { data: rows, error } = await admin
  .from("payments")
  .select("*")
  .eq("payment_type", "rent_payment")
  .eq("status", "pending")
  .not("mpesa_checkout_id", "is", null)
  .order("created_at", { ascending: false })
  .limit(20);

if (error) throw error;

for (const row of rows || []) {
  const meta = row.metadata || {};
  if (meta.mpesaProvider && meta.mpesaProvider !== "intasend") continue;
  const checkout = row.mpesa_checkout_id;
  const st = await intasendStatus(checkout);
  console.log(row.id, checkout, "→", st.state, "ref", st.mpesaRef);

  if (["FAILED", "CANCELED", "CANCELLED", "DECLINED"].includes(st.state)) {
    await admin
      .from("payments")
      .update({ status: "failed" })
      .eq("id", row.id)
      .eq("status", "pending");
    console.log("  marked failed");
    continue;
  }
  if (!["COMPLETE", "COMPLETED", "SUCCESS"].includes(st.state)) continue;

  const receipt = st.mpesaRef || checkout;
  const { data: completed, error: upErr } = await admin
    .from("payments")
    .update({ status: "completed", mpesa_receipt: receipt })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (upErr) {
    console.error("  payment update failed", upErr);
    continue;
  }
  if (!completed) {
    console.log("  already settled");
    continue;
  }

  const invoiceId = meta.invoiceId;
  if (!invoiceId) {
    console.error("  missing invoiceId");
    continue;
  }

  const ctx = await loadOwnerProperty(invoiceId);
  if (!ctx?.inv) {
    console.error("  invoice missing", invoiceId);
    continue;
  }

  const { data: existingPay } = await admin
    .from("pm_rent_payments")
    .select("id")
    .eq("payment_id", completed.id)
    .maybeSingle();

  let rentPaymentId = existingPay?.id;
  if (!rentPaymentId) {
    const { data: rp, error: rpErr } = await admin
      .from("pm_rent_payments")
      .insert({
        invoice_id: invoiceId,
        amount: completed.amount_kes,
        method: "mpesa",
        recorded_by_user_id: completed.user_id,
        payment_id: completed.id,
        mpesa_receipt_number: receipt,
      })
      .select("id")
      .single();
    if (rpErr) {
      console.error("  rent payment insert failed", rpErr);
      continue;
    }
    rentPaymentId = rp.id;
  }

  const { data: pays } = await admin
    .from("pm_rent_payments")
    .select("amount")
    .eq("invoice_id", invoiceId);
  const totalPaid = (pays || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const amountDue = Number(ctx.inv.amount_due || 0) + Number(ctx.inv.late_fee || 0);
  const fullyPaid = totalPaid + 0.001 >= amountDue;
  await admin
    .from("pm_rent_invoices")
    .update({
      amount_paid: totalPaid,
      status: fullyPaid ? "paid" : "partial",
      paid_at: fullyPaid ? new Date().toISOString() : ctx.inv.paid_at,
    })
    .eq("id", invoiceId);

  if (ctx.property) {
    const gross = Number(completed.amount_kes);
    const fee = Math.max(1, Math.round(gross * 0.01));
    const net = Math.max(0, gross - fee);
    const { data: feeExisting } = await admin
      .from("pm_platform_fee_ledger")
      .select("id")
      .eq("rent_payment_id", rentPaymentId)
      .maybeSingle();
    if (!feeExisting) {
      await admin.from("pm_platform_fee_ledger").insert({
        rent_payment_id: rentPaymentId,
        owner_user_id: ctx.property.owner_user_id,
        property_id: ctx.property.id,
        gross_amount: gross,
        platform_fee: fee,
        net_payout_amount: net,
      });
    }
  }

  console.log("  settled rent", {
    rentPaymentId,
    totalPaid,
    invoiceStatus: fullyPaid ? "paid" : "partial",
  });
}

console.log("Done");
