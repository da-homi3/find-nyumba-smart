import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { initiateStkPush } from "@/lib/api/mpesa";
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

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function downgradeUser(supabaseAdmin: Admin, sub: SubscriptionRow) {
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
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("phone")
    .eq("id", sub.user_id)
    .maybeSingle();
  const phone = profile?.phone;
  if (!phone) return;

  try {
    let phone254 = phone.replaceAll("+", "").trim();
    if (phone254.startsWith("0")) phone254 = "254" + phone254.slice(1);
    await initiateStkPush({
      phone254,
      amountKes: amount,
      accountReference: "NS-renew",
      transactionDesc: "NyumbaRenew",
    });
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

    // Pesapal has no tokenized card charges — renew via M-Pesa STK for all subs.
    if (sub.payment_method === "mpesa" || sub.payment_method === "card") {
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
  }

  const { data: overdue } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("status", "past_due")
    .lte("grace_period_end", now);

  for (const sub of overdue ?? []) {
    await downgradeUser(supabaseAdmin, sub);
    stats.cancelled += 1;
  }

  return stats;
}
