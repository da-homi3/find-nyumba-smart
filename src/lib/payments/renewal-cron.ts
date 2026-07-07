import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { initiateStkPush, isMpesaConfigured } from "@/lib/api/mpesa";
import {
  PLUS_PLAN,
  planMonthlyPrice,
  providerTierPrice,
  resolveLandlordPlan,
} from "@/lib/revenue/plans";

type Admin = SupabaseClient<Database>;

type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];

function planAmountKes(sub: SubscriptionRow): number {
  if (sub.plan === "plus") {
    return sub.billing_cycle === "quarterly" ? PLUS_PLAN.quarterlyKes : PLUS_PLAN.monthlyKes;
  }
  if (sub.plan === "basic" || sub.plan === "featured" || sub.plan === "premium") {
    const base = providerTierPrice(sub.plan);
    return sub.billing_cycle === "quarterly" ? Math.round(base * 3 * 0.9) : base;
  }
  const planId = resolveLandlordPlan(sub.plan);
  const cycle = sub.billing_cycle === "quarterly" ? "quarterly" : "monthly";
  return planMonthlyPrice(planId, cycle);
}

function renewalPaymentType(sub: SubscriptionRow): string {
  if (sub.plan === "plus") return "tenant_plus";
  if (sub.plan === "basic" || sub.plan === "featured" || sub.plan === "premium") {
    return "provider_subscription";
  }
  return "landlord_plan";
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatPhone254(phone: string): string {
  let clean = phone.replaceAll("+", "").trim();
  if (clean.startsWith("0")) clean = "254" + clean.slice(1);
  else if (clean.startsWith("7") || clean.startsWith("1")) clean = "254" + clean;
  return clean;
}

async function downgradeUser(supabaseAdmin: Admin, sub: SubscriptionRow) {
  const { onTrialFailedToConvert } = await import("@/lib/promo/founding-member-lifecycle");
  await onTrialFailedToConvert(supabaseAdmin, sub.user_id);

  if (sub.plan === "plus") {
    await supabaseAdmin
      .from("profiles")
      .update({ tenant_plan: "free", plus_expires_at: null })
      .eq("id", sub.user_id);
  } else if (sub.plan === "basic" || sub.plan === "featured" || sub.plan === "premium") {
    await supabaseAdmin
      .from("service_providers")
      .update({ status: "suspended" })
      .eq("user_id", sub.user_id);
  } else {
    await supabaseAdmin.from("profiles").update({ landlord_plan: "free" }).eq("id", sub.user_id);
  }
  await supabaseAdmin.from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id);
}

async function sendRenewalStk(
  supabaseAdmin: Admin,
  sub: SubscriptionRow,
  amount: number,
  stats: { stkSent: number },
) {
  if (!isMpesaConfigured()) return;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("phone")
    .eq("id", sub.user_id)
    .maybeSingle();
  const phone = profile?.phone;
  if (!phone) return;

  const phone254 = formatPhone254(phone);
  const paymentType = renewalPaymentType(sub);
  const idempotencyKey = `renew-${sub.id}-${sub.next_billing_date.slice(0, 10)}`;

  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing?.status === "completed") return;

  let paymentId = existing?.id;
  if (!paymentId) {
    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: sub.user_id,
        amount_kes: amount,
        status: "pending",
        payment_type: paymentType,
        payment_method: "mpesa",
        mpesa_phone: phone254,
        idempotency_key: idempotencyKey,
        metadata: {
          title: "NyumbaSearch renewal",
          plan: sub.plan,
          billingCycle: sub.billing_cycle,
          paymentMethod: "mpesa",
          renewalSubscriptionId: sub.id,
        },
      })
      .select("id")
      .single();
    if (error || !payment) {
      console.error("[renewal-cron] payment insert failed:", sub.id, error);
      return;
    }
    paymentId = payment.id;
  }

  try {
    const stk = await initiateStkPush({
      phone254,
      amountKes: amount,
      accountReference: paymentId.slice(0, 12),
      transactionDesc: "NyumbaRenew",
    });
    await supabaseAdmin
      .from("payments")
      .update({ mpesa_checkout_id: stk.checkoutRequestId })
      .eq("id", paymentId);
    stats.stkSent += 1;
  } catch (err) {
    console.error("[renewal-cron] M-Pesa STK failed:", sub.id, err);
  }
}

export async function runSubscriptionRenewalCron(supabaseAdmin: Admin): Promise<{
  renewed: number;
  stkSent: number;
  pastDue: number;
  cancelled: number;
}> {
  const stats = { renewed: 0, stkSent: 0, pastDue: 0, cancelled: 0 };
  const now = new Date().toISOString();
  const soon = new Date();
  soon.setDate(soon.getDate() + 2);

  const { data: expiring } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .in("status", ["active", "trialing"])
    .lte("next_billing_date", soon.toISOString());

  for (const sub of expiring ?? []) {
    const amount = planAmountKes(sub);
    await sendRenewalStk(supabaseAdmin, sub, amount, stats);
    await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "past_due",
        grace_period_end: addDays(now, 3),
      })
      .eq("id", sub.id);
    stats.pastDue += 1;
  }

  const { data: overdue } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("status", "past_due")
    .not("grace_period_end", "is", null)
    .lte("grace_period_end", now);

  for (const sub of overdue ?? []) {
    await downgradeUser(supabaseAdmin, sub);
    stats.cancelled += 1;
  }

  return stats;
}
